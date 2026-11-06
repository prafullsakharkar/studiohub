"""
Bulk mixin for production viewsets.

Extends the shared core ``BulkActionsMixin`` so every bulk item is checked
exactly like its single counterpart: the entity's create/update serializer, the
same-project reference checks, the privileged-value guard and the status
workflow of the viewset. The service stays free of API imports; it only calls
the callables it is handed.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from typing import Any, ClassVar

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from apps.core.api.mixins.bulk import BulkActionsMixin
from apps.production.services.audit import record_bulk_batch
from apps.production.services.status import StatusService

#: Most items one bulk-create or bulk-update request may carry (CR-48); a bigger one is a 400.
BULK_MAX_ITEMS = 500

NOT_BULK_UPDATABLE = "This field cannot be changed in bulk."

# A row that failed without an error text: what the flat ``errors`` list says about it.
_STATUS_ERRORS = {
    "exists": ("code", "A record with this code already exists."),
    "soft_deleted": (
        "code",
        "A record with this code is archived: recover it or use another code.",
    ),
    "duplicate": ("code", "This code is given more than once in the batch."),
    "not_found": ("id", "Not found."),
}
_STATUS_FIELD = {"duplicate": "code", "not_found": "id"}


def _walk(error: Any, field: str | None = None) -> Iterator[tuple[str | None, str]]:
    """``(field, message)`` pairs of a DRF error (a text, a list, or a field map, nested)."""
    if isinstance(error, dict):
        for key, value in error.items():
            name = (
                None
                if key in ("non_field_errors", "detail")
                else (f"{field}.{key}" if field else str(key))
            )
            yield from _walk(value, name)
    elif isinstance(error, (list, tuple)):
        for value in error:
            yield from _walk(value, field)
    elif error not in (None, ""):
        yield field, str(error)


def flat_errors(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """``[{row, field, message}]`` for every row that was not written; ``row`` is its ``index``."""
    out: list[dict[str, Any]] = []
    for row in rows:
        if row.get("success"):
            continue
        status, error = str(row.get("status") or ""), row.get("error")
        pairs = list(_walk(error, _STATUS_FIELD.get(status))) if error else []
        if not pairs:
            pairs = [_STATUS_ERRORS.get(status, (None, "The row was not written."))]
        out.extend({"row": row.get("index"), "field": f, "message": m} for f, m in pairs)
    return out


class ProductionBulkMixin(BulkActionsMixin):
    #: Fields ``bulk-update`` may change (CR-48). Any other writable field of the update serializer
    #: is refused on the row; project, code, show, ownership and approval fields are never listed.
    bulk_update_fields: ClassVar[tuple[str, ...]] = ()

    # Provided by ``ProductionEntityViewSet`` / ``ServiceModelViewSet`` (annotations only).
    serializer_map: dict[str, Any]  # pyright: ignore[reportUninitializedInstanceVariable]
    validate_references: Callable[..., None]  # pyright: ignore[reportUninitializedInstanceVariable]
    prepare_create: Callable[..., None]  # pyright: ignore[reportUninitializedInstanceVariable]
    check_update: Callable[..., None]  # pyright: ignore[reportUninitializedInstanceVariable]
    bulk_scope: Callable[..., Any]  # pyright: ignore[reportUninitializedInstanceVariable]
    _resolve_show: Callable[..., None]  # pyright: ignore[reportUninitializedInstanceVariable]
    _with_default_show: Callable[..., dict[str, Any]]  # pyright: ignore[reportUninitializedInstanceVariable]
    _guard_privileged_values: Callable[..., None]  # pyright: ignore[reportUninitializedInstanceVariable]
    _guard_initial_status: Callable[..., None]  # pyright: ignore[reportUninitializedInstanceVariable]
    _apply_update: Callable[..., Any]  # pyright: ignore[reportUninitializedInstanceVariable]

    def _bulk_service_kwargs(self, operation):
        if operation == "create":
            return {"validate": self._validate_bulk_create_item}
        if operation == "update":
            # Items follow the normal map: no override in bulk.
            return {
                "validate": self._validate_bulk_item,
                "update": lambda instance, data: self._apply_update(
                    instance, data, allow_override=False
                ),
                # Ids resolve inside the single routes' narrowing (CR-46).
                "scope": self.bulk_scope,
            }
        return {}

    def hide_unseen(self, results):
        """
        Drop the id (and archive date) of an existing row the caller may not see. The code being
        taken is still said, as a single create's 400 says it; which row holds it is not (CR-46).
        """
        named = ("exists", "soft_deleted")
        ids = [r["id"] for r in results if r.get("id") and r.get("status") in named]
        if not ids:
            return results
        model = self.service_class.model  # pyright: ignore[reportAttributeAccessIssue]
        visible = self.bulk_scope(model.all_objects.filter(pk__in=ids))
        seen = {str(pk) for pk in visible.values_list("pk", flat=True)}
        cleaned = []
        for result in results:
            if result.get("status") in named and result.get("id") and str(result["id"]) not in seen:
                result = {k: v for k, v in result.items() if k not in ("id", "deleted_at")}
            cleaned.append(result)
        return cleaned

    def _bulk_create_union(self, results, *, summary_extra=None):
        return super()._bulk_create_union(self.hide_unseen(results), summary_extra=summary_extra)

    # ------------------------------------------------------------------
    # CR-48: dry run, all-or-nothing, limits, flat errors, one audit row
    # ------------------------------------------------------------------

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request, *args, **kwargs):
        parent = super().bulk_create
        items = (request.data or {}).get("items") if isinstance(request.data, dict) else None
        return self._run_batch("create", items, lambda: parent(request, *args, **kwargs))

    @action(detail=False, methods=["post", "patch"], url_path="bulk-update")
    def bulk_update(self, request, *args, **kwargs):
        items = self._bulk_update_items_from_request()
        return self._run_batch("update", items, lambda: self._bulk_update_response(items))

    def _batch_flags(self) -> tuple[bool, bool]:
        """``(dry_run, atomic)`` from the body; both default to false (the routes' former behaviour)."""
        data = self.request.data if isinstance(self.request.data, dict) else {}
        flags = []
        for name in ("dry_run", "atomic"):
            try:
                flags.append(serializers.BooleanField().to_internal_value(data.get(name, False)))
            except serializers.ValidationError:
                raise ValidationError({name: ["Must be true or false."]}) from None
        return flags[0], flags[1]

    def _run_batch(self, operation: str, items: Any, call: Callable[[], Any]):
        """
        Run one bulk ``operation``. ``dry_run`` runs every check and write and rolls them all back;
        ``atomic`` rolls the batch back when a row fails. A committed batch with a written row gets
        one ``AuditLog`` row. The response adds ``dry_run``, ``atomic``, ``committed`` and ``errors``.
        """
        dry_run, atomic = self._batch_flags()
        if isinstance(items, list) and len(items) > BULK_MAX_ITEMS:
            raise ValidationError({"items": [f"At most {BULK_MAX_ITEMS} items per request."]})
        with transaction.atomic():
            response = call()
            data = response.data
            committed = not dry_run and not (atomic and data.get("failed"))
            if committed:
                self._audit_batch(operation, data, atomic=atomic)
            else:
                transaction.set_rollback(True)
        if not committed:
            # Nothing was written: a created row has no id, and holds no entity, to show.
            for row in data.get("results", []):
                if row.get("status") == self.service_class.CREATED:  # pyright: ignore[reportAttributeAccessIssue]
                    row.pop("entity", None)
                    row["id"] = None
        data.update({"dry_run": dry_run, "atomic": atomic, "committed": committed})
        data["errors"] = flat_errors(data.get("results", []))
        return response

    def _audit_batch(self, operation: str, data: dict[str, Any], *, atomic: bool) -> None:
        if not data.get("successful"):
            return
        summary = data.get("summary") or {}
        model = self.service_class.model  # pyright: ignore[reportAttributeAccessIssue]
        ids = [row["id"] for row in data.get("results", []) if row.get("success") and row.get("id")]
        # ``order_by()``: the model's ordering would otherwise join the DISTINCT and repeat a project.
        projects = (
            model.all_objects.filter(pk__in=ids)
            .order_by()
            .values_list("project_id", flat=True)
            .distinct()
        )
        record_bulk_batch(
            actor=self.request.user,
            model=model,
            operation=operation,
            operation_id=data["operation_id"],
            project_ids=sorted(str(pk) for pk in projects),
            counts={
                "total": data.get("processed", 0),
                "successful": data.get("successful", 0),
                "failed": data.get("failed", 0),
                **{
                    key: summary.get(f"{key}Count", 0)
                    for key in ("created", "updated", "recovered", "skipped")
                },
            },
            atomic=atomic,
        )

    # ------------------------------------------------------------------
    # CR-48: bulk update matched by id or code, through the whitelist
    # ------------------------------------------------------------------

    def _bulk_update_response(self, items: list[Any]):
        """
        Each item names its row by ``id`` or by ``code`` within ``project_id`` (the item's or the
        body's); both given must name the same row. Rows resolve inside the single routes'
        narrowing, so an unseen row is ``not_found``. Fields outside ``bulk_update_fields`` refuse
        the row. Accepted items go to the service; every row keeps its position.
        """
        service = self.service_class  # pyright: ignore[reportAttributeAccessIssue]
        body = self.request.data if isinstance(self.request.data, dict) else {}
        decided: dict[int, dict[str, Any]] = {}
        accepted: list[dict[str, Any]] = []
        positions: list[int] = []
        for index, raw in enumerate(items):
            item = dict(raw) if isinstance(raw, dict) else {}
            outcome = self._match_update_item(
                item, project_ref=item.get("project_id") or body.get("project_id")
            )
            if outcome is not None:
                decided[index] = {"index": index, **outcome}
                continue
            accepted.append(item)
            positions.append(index)
        if accepted:
            results = service.bulk_update(
                accepted,
                organization=self._organization(),
                user=self.request.user,  # pyright: ignore[reportAttributeAccessIssue]
                **self._bulk_service_kwargs("update"),
            )
            for result, position in zip(results, positions, strict=True):
                decided[position] = {**result, "index": position}
        return self._bulk_create_union([decided[i] for i in sorted(decided)])

    def _match_update_item(
        self, item: dict[str, Any], *, project_ref: Any
    ) -> dict[str, Any] | None:
        """
        Resolve ``item`` in place to ``{"id": ..., fields}``; a result for a row that stops here.
        ``code`` and ``project_id`` are keys, never changes.
        """
        service = self.service_class  # pyright: ignore[reportAttributeAccessIssue]
        model = service.model
        code = service._normalize_code(item.pop("code", None))
        item.pop("project_id", None)
        missing = {"status": service.NOT_FOUND, "error": f"{model.__name__} not found."}
        project = None
        if project_ref:
            project = service._get_project(project_id=project_ref)
            if project is None:
                # Like a project the caller cannot see: its rows are simply not found.
                return {**missing, "code": code}
        if not item.get("id"):
            if not code:
                return {
                    "status": service.INVALID,
                    "error": {"id": ["Give the row's id or its code."]},
                }
            if project is None:
                return {
                    "status": service.INVALID,
                    "code": code,
                    "error": {"project_id": ["Needed to match a row by code."]},
                }
            row = self.bulk_scope(model.objects.filter(project=project, code__iexact=code)).first()
            if row is None:
                return {**missing, "code": code}
            item["id"] = str(row.pk)
        elif code or project is not None:
            try:
                row = self.bulk_scope(model.objects.filter(pk=item["id"])).first()
            except (ValueError, TypeError, DjangoValidationError):
                row = None
            if row is None or (project is not None and row.project_id != project.pk):
                return {**missing, "id": None}
            if code and row.code.upper() != code:
                return {
                    "status": service.INVALID,
                    "id": str(row.pk),
                    "error": {"code": ["The id and the code name different rows."]},
                }
        refused = self._fields_not_bulk_updatable(service._item_fields(item))
        if refused:
            return {
                "status": service.INVALID,
                "id": str(item["id"]),
                "error": {name: [NOT_BULK_UPDATABLE] for name in refused},
            }
        return None

    def _fields_not_bulk_updatable(self, fields: dict[str, Any]) -> list[str]:
        """The writable update fields ``fields`` sets that ``bulk_update_fields`` leaves out."""
        writable = {
            name
            for name, field in self.serializer_map["partial_update"]().fields.items()
            if not field.read_only
        }
        allowed = set(self.bulk_update_fields)
        return sorted(name for name in fields if name in writable and name not in allowed)

    @staticmethod
    def _errors_of(exc: APIException) -> Any:
        return exc.detail

    def _validate_bulk_create_item(self, project, item) -> tuple[dict[str, Any] | None, Any]:
        """``(data to create with, None)`` for an acceptable item, else ``(None, errors)``."""
        serializer = self.serializer_map["create"](data=item, context=self.get_serializer_context())
        if not serializer.is_valid():
            return None, serializer.errors
        try:
            self._enforce_project_code_prefix(serializer, project)
            self.prepare_create(serializer, project)
            data = {**serializer.validated_data, "project": project}
            self.validate_references(project, data)
            self._guard_privileged_values(data)
            self._guard_initial_status(data)
            # Filed under a show like a single create: a show-bound caller's rows go to their show.
            self._resolve_show(project, data)
            data = self._with_default_show(self.service_class.model, project, data)  # pyright: ignore[reportAttributeAccessIssue]
        except (ValidationError, PermissionDenied, APIException) as exc:
            return None, self._errors_of(exc)
        return data, None

    def _validate_bulk_item(self, instance, data) -> tuple[dict[str, Any] | None, Any]:
        """``(validated data, None)`` for an acceptable item, else ``(None, errors)``."""
        serializer_class = self.serializer_map["partial_update"]
        serializer = serializer_class(
            instance=instance, data=data, partial=True, context=self.get_serializer_context()
        )
        if not serializer.is_valid():
            return None, serializer.errors
        validated = dict(serializer.validated_data)
        try:
            # The single update's chain: mutability, the episode rule, references, privileged
            # values, the show (CR-46).
            self.check_update(instance, validated)
            if self.workflow_key and validated.get("status") not in (None, instance.status):  # pyright: ignore[reportAttributeAccessIssue]
                StatusService.check(
                    actor=self.request.user,  # pyright: ignore[reportAttributeAccessIssue]
                    entity=instance,
                    to_status=validated["status"],
                    has_permission=self.can,  # pyright: ignore[reportAttributeAccessIssue]
                    has_explicit=lambda code: False,
                )
        except (ValidationError, PermissionDenied, APIException) as exc:
            return None, self._errors_of(exc)
        return validated, None
