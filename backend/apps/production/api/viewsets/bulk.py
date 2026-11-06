"""
Bulk mixin for production viewsets.

Extends the shared core ``BulkActionsMixin`` so every bulk item is checked
exactly like its single counterpart: the entity's create/update serializer, the
same-project reference checks, the privileged-value guard and the status
workflow of the viewset. The service stays free of API imports; it only calls
the callables it is handed.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from apps.core.api.mixins.bulk import BulkActionsMixin
from apps.production.services.status import StatusService


class ProductionBulkMixin(BulkActionsMixin):
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

    @staticmethod
    def _errors_of(exc: APIException) -> Any:
        return exc.detail

    def _validate_bulk_create_item(self, project, item) -> tuple[dict[str, Any] | None, Any]:
        """``(data to create with, None)`` for an acceptable item, else ``(None, errors)``."""
        serializer = self.serializer_map["create"](data=item, context=self.get_serializer_context())
        if not serializer.is_valid():
            return None, serializer.errors
        try:
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
