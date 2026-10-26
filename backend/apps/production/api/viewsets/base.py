"""
Base ViewSet for Production entities.
"""

from __future__ import annotations

from typing import Any, ClassVar

from django.db import transaction
from django.http import Http404
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.core.api.viewsets.service import ServiceModelViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.production.constants import workflow
from apps.production.permissions.checks import has_explicit_permission_code, has_permission_code
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.services.status import StatusService


class ProductionEntityViewSet(ServiceModelViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """
    Base ViewSet for all Production project-scoped entities.

    Shared by:

        • Project
        • Shot
        • Asset
        • Task
        • Timelog
        • Version
        • Review
        • Media
        • Playlist
        • Workflow

    There is no organization context: ``Project`` is the sole scope
    boundary and every query is narrowed to the caller's active
    ``ProjectMembership`` set (fail closed). Create operations resolve the
    related project from the request and verify membership before saving.

    Concrete bulk viewsets inherit with this class FIRST
    (``ProductionEntityViewSet, BulkActionsMixin``) so the project-scoped
    overrides below (``_organization`` compat, existence check, recover,
    archive) win over the shared core bulk mixin, which is de-orged
    separately.
    """

    permission_classes = (
        IsAuthenticatedPermission,
        HasPermission,
    )

    #: field -> {value: permission code} (values may be booleans). Setting a field to such a value, or
    #: moving it away from it, through plain create/update needs the code on top
    #: of the action's own (e.g. ``shot.approve`` to approve a shot with PATCH).
    privileged_values: ClassVar[dict[str, dict[Any, str]]] = {}

    def get_queryset(self):
        if self._include_deleted() and self._may_view_deleted():
            # Frontend contract: ?include_deleted / ?include_archived opts into
            # soft-deleted rows (still strictly project-membership scoped).
            # Viewing deleted rows requires the resource DELETE grant (or
            # superuser); otherwise the flag is ignored and live rows are
            # returned.
            qs = self.service_class.model.all_objects.all()
        else:
            qs = self.selector_class.get_queryset(
                request=self.request,
                view=self,
            )
        # ``?is_archived=`` selects by the soft delete (D-25); asking for archived rows without the
        # grant to see them yields none, never the live ones.
        archived = self._archived_param()
        if archived is not None:
            qs = qs.filter(is_deleted=archived)
        qs = ProductionBaseSelector.scope_by_request(
            qs,
            request=self.request,
            view=self,
        )
        return self.narrow_queryset(
            ProductionBaseSelector.scope_by_project_membership(
                qs,
                request=self.request,
            )
        )

    def perform_destroy(self, instance):
        self.guard_mutable(instance)
        super().perform_destroy(instance)

    def after_archive(self, instance):
        """Hook: entity-specific bookkeeping once ``instance`` is archived (same transaction)."""

    def after_restore(self, instance):
        """Hook: entity-specific bookkeeping once ``instance`` is restored."""

    def narrow_queryset(self, queryset):
        """Hook: narrow what the caller may see beyond project membership (e.g. own records)."""
        return queryset

    def guard_mutable(self, instance):
        """Hook: raise when ``instance`` may no longer be edited, deleted or archived."""

    def _may_view_deleted(self):
        """Whether the caller may list soft-deleted rows (DELETE grant)."""
        from apps.identity.services.permission_cache import PermissionCacheService

        user = getattr(self.request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return False
        if getattr(user, "is_superuser", False):
            return True
        codes = self.permission_map.get("destroy", ())
        if not codes:
            return False
        return all(
            PermissionCacheService.has_permission(
                user=user,
                permission=code,
            )
            for code in codes
        )

    def _archived_param(self):
        """True or False when ``?is_archived=`` says so, else None."""
        params = getattr(self.request, "query_params", {}) or {}
        value = params.get("is_archived")
        if not isinstance(value, str):
            return None
        value = value.strip().lower()
        if value in ("true", "1", "yes"):
            return True
        if value in ("false", "0", "no"):
            return False
        return None

    def _include_deleted(self):
        params = getattr(self.request, "query_params", {}) or {}
        # ``is_archived=true`` asks for archived (= soft-deleted) rows too, like include_archived.
        for key in ("include_deleted", "include_archived", "is_archived"):
            value = params.get(key)
            if isinstance(value, str) and value.lower() in ("true", "1", "yes"):
                return True
            if value is True:
                return True
        return False

    def get_object(self):
        # Frontend contract: detail lookup accepts the UUID id OR the entity
        # code (case-insensitive). Fall back to code when UUID lookup 404s.
        try:
            return super().get_object()
        except Http404:
            pass
        lookup = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        model = self.service_class.model
        try:
            model._meta.get_field("code")
        except Exception:  # noqa: BLE001
            raise Http404 from None
        queryset = self.filter_queryset(self.get_queryset())
        try:
            obj = queryset.filter(code__iexact=lookup).first()
        except (ValueError, TypeError):
            obj = None
        if obj is None:
            raise Http404
        self.check_object_permissions(self.request, obj)
        return obj

    # ------------------------------------------------------------------
    # Organization-free compat for the shared core bulk mixin
    # ------------------------------------------------------------------

    def _organization(self):
        """
        Legacy hook for ``apps.core.api.mixins.bulk.BulkActionsMixin``.

        The organization partition no longer exists; production bulk
        services accept the keyword and ignore it, scoping by project
        membership instead. Returns ``None`` always.
        """
        return None

    @action(detail=False, methods=["post"], url_path="check-existence")
    def check_existence(self, request, *args, **kwargs):
        """Project-scoped existence check (passes the user for gating)."""
        items = self._existence_items_from_request()
        results = self.service_class.bulk_check_existence(
            items,
            user=request.user,
        )
        return self._existence_response(items, results)

    @action(detail=False, methods=["post"], url_path="existence-check")
    def existence_check(self, request, *args, **kwargs):
        """Legacy alias of ``check-existence/`` (kept for compatibility)."""
        return self.check_existence(request, *args, **kwargs)

    def _recover_item(self, *, project_id, code, existing_id, organization=None):
        """Project-scoped archived-row recovery for frontend-form creates."""
        service = self.service_class
        instance = None
        if existing_id:
            instance = self._fetch_instance(existing_id)
        if instance is None and project_id and code:
            project = service._get_project(project_id=project_id)
            if project is not None:
                instance = service.model.all_objects.filter(
                    project=project, code=code,
                ).first()
        if instance is None or not instance.is_deleted:
            return {
                "status": service.INVALID, "code": code,
                "error": "No archived row found to recover.",
            }
        if project_id and hasattr(instance, "project_id"):
            # The caller named a project: the recovered row must belong to
            # it (cross-project recovery is rejected as an invalid item
            # rather than silently applied).
            project = service._get_project(project_id=project_id)
            if project is None or instance.project_id != project.id:
                return {
                    "status": service.INVALID, "code": code,
                    "error": "Archived row does not belong to the given project.",
                }
        if not ProductionBaseSelector.user_has_project_access(
            request=self.request, project=instance.project if hasattr(instance, "project") else None,
        ):
            return {
                "status": service.INVALID, "code": code,
                "error": "No archived row found to recover.",
            }
        service.restore(instance)
        return {"status": "recovered", "id": str(instance.id), "code": code, "entity": instance}

    # ------------------------------------------------------------------
    # Soft-delete archive listing / restore
    # ------------------------------------------------------------------

    def _bulk_lifecycle_results(self, *, ids, action):
        """Run bulk archive/restore with per-item reporting.

        The full id list reaches the service (never pre-dropped): ids
        outside the caller's project set report per-item ``not_found``
        without leaking existence — consistent with ``bulk_update`` and
        ``bulk_check_existence``.
        """
        if action == "restore":
            results = self.service_class.bulk_restore(
                ids,
                user=self.request.user,
            )
            return self._bulk_archive_union(results, count_key="restoredCount")
        results = self.service_class.bulk_archive(
            ids,
            user=self.request.user,
        )
        return self._bulk_archive_union(results, count_key="archivedCount")

    @action(detail=False, methods=["get"], url_path="archived")
    def archived(self, request):
        """List soft-deleted records within the caller's project scope."""
        model = self.service_class.model
        qs = model.all_objects.filter(is_deleted=True)
        project_id = request.query_params.get("project_id")
        if project_id and hasattr(model, "project"):
            qs = qs.filter(project_id=project_id)
        qs = self.narrow_queryset(ProductionBaseSelector.scope_by_project_membership(qs, request=request))
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, *args, **kwargs):
        """Soft-delete a record within the caller's project scope."""
        model = self.service_class.model
        queryset = self.narrow_queryset(
            ProductionBaseSelector.scope_by_project_membership(
                model.objects.filter(
                    pk=self.kwargs.get(self.lookup_url_kwarg or self.lookup_field),
                ),
                request=request,
            )
        )
        instance = queryset.first()
        if instance is None:
            raise NotFound(f"{model.__name__} not found.")
        self.guard_mutable(instance)
        # One unit: a refusal by the service (live children, D-13) leaves the status alone.
        with transaction.atomic():
            self._set_status(instance, "Archived")
            self.service_class.delete(instance, user=request.user)
            self.after_archive(instance)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        """Restore a soft-deleted record within the caller's project scope."""
        model = self.service_class.model
        queryset = self.narrow_queryset(
            ProductionBaseSelector.scope_by_project_membership(
                model.all_objects.filter(
                    pk=self.kwargs.get(self.lookup_url_kwarg or self.lookup_field),
                ),
                request=request,
            )
        )
        instance = queryset.first()
        if instance is None or not instance.is_deleted:
            raise NotFound(f"{model.__name__} not found.")
        restored = self.service_class.restore(instance, user=request.user)
        if self.workflow_key:
            # Back to the status it had before it was archived, not stuck in Archived.
            StatusService.restore_status(actor=request.user, entity=restored)
        self.after_restore(restored)
        serializer = self.get_serializer(restored)
        return Response(serializer.data)

    def _resolve_project_from_input(self, serializer):
        """
        Resolve the related project for a create operation.

        The frontend contract sends ``project_id`` (UUID string, real id or
        mock id) or ``project_code`` instead of the ``project`` PK field; the
        write serializers land those in ``validated_data["project"]`` as raw
        strings. Resolve globally (UUID/code/mock-id aware); fail closed
        with a 400 when a reference was supplied but resolves to nothing.
        Returns None only when the input carried no project reference at all.
        """
        from rest_framework.exceptions import ValidationError

        from apps.production.selectors.project import ProjectSelector

        # Skip project resolution for models without a project field
        # (e.g., Project itself doesn't have a project field)
        model = self.get_queryset().model
        if not hasattr(model, "project"):
            return None

        validated = serializer.validated_data
        data = validated if isinstance(validated, dict) else {}
        project = data.get("project")
        if project is not None and not isinstance(project, str):
            return project
        raw = serializer.initial_data or {}
        ref = project if isinstance(project, str) else None
        ref = ref or raw.get("project_id", None) or raw.get("project_code", None)
        if ref is None:
            return None
        resolved = ProjectSelector.resolve_by_lookup(ref)
        if resolved is None:
            raise ValidationError({"project_id": "Unknown project."})
        return resolved

    def perform_create(self, serializer):
        validated = serializer.validated_data
        data = validated if isinstance(validated, dict) else {}
        model = self.get_queryset().model
        if not hasattr(model, "project"):
            # Models without a project field (e.g., Project itself) are
            # created directly; permission gating happens via HasPermission
            # and reads stay membership-scoped.
            serializer.instance = self.service_class.create(  # pyright: ignore[reportAttributeAccessIssue]
                user=self.request.user, **dict(data)
            )
            return

        project = data.get("project")
        if project is None or isinstance(project, str):
            project = self._resolve_project_from_input(serializer)
        if project is None:
            raise ValidationError({"project": "This field is required."})
        # Creating into a project outside the caller's membership/admin
        # scope fails closed without an existence leak.
        if not ProductionBaseSelector.user_has_project_access(
            request=self.request,
            project=project,
        ):
            raise ValidationError({"project_id": "Unknown project."})
        self._enforce_natural_key_uniqueness(project, data)
        self.prepare_create(serializer, project)
        self.validate_references(project, data)
        self._guard_privileged_values(data)
        self._guard_initial_status(data)
        # Always pass the resolved instance: validated_data may carry the
        # raw reference string from the project_id/project_code aliases,
        # which the ORM cannot assign to the FK directly. The service sets
        # created_by/updated_by.
        serializer.instance = self.service_class.create(  # pyright: ignore[reportAttributeAccessIssue]
            user=self.request.user, **{**data, "project": project}
        )

    def perform_update(self, serializer):  # pyright: ignore[reportIncompatibleMethodOverride]
        instance = serializer.instance
        self.guard_mutable(instance)
        data = serializer.validated_data if isinstance(serializer.validated_data, dict) else {}
        self.validate_references(getattr(instance, "project", None), data, instance=instance)
        self._guard_privileged_values(data, instance=instance)
        serializer.instance = self._apply_update(instance, dict(data))

    # -- status workflow ------------------------------------------------

    @property
    def workflow_key(self) -> str | None:
        """Workflow entity key of this viewset's model (None: no status workflow)."""
        return workflow.ENTITY_FOR_MODEL.get(self.service_class.model.__name__)

    def can(self, code: str) -> bool:
        """Whether the request holds ``code`` (credential scopes included)."""
        return has_permission_code(self.request, code)

    def can_explicit(self, code: str) -> bool:
        """Whether a role grants ``code`` to the caller; superuser does not imply it (override codes)."""
        return has_explicit_permission_code(self.request, code)

    def status_kwargs(self, override_reason: str | None = None) -> dict[str, Any]:
        """Permission arguments for ``StatusService`` calls made on behalf of this request."""
        return {
            "has_permission": self.can,
            "has_explicit": self.can_explicit,
            "override_reason": override_reason,
        }

    def _override_reason(self) -> str | None:
        """``override_reason`` of a single-record write (never read from a bulk body)."""
        body = self.request.data
        return str(body.get("override_reason") or "") if hasattr(body, "get") else None

    def _apply_update(self, instance, data, *, allow_override=True):
        """
        Save ``data`` on ``instance`` through the service, as the caller.

        A changed ``status`` goes through ``StatusService`` (map, permission,
        history) in the same transaction; the other fields are saved after it.
        """
        data = dict(data)
        new_status = data.pop("status", None) if self.workflow_key else None
        with transaction.atomic():
            if new_status is not None and new_status != instance.status:
                kwargs = self.status_kwargs(self._override_reason() if allow_override else None)
                if not allow_override:
                    kwargs["has_explicit"] = lambda code: False
                StatusService.transition_status(
                    actor=self.request.user, entity=instance, to_status=new_status, **kwargs
                )
            return self.service_class.update(  # pyright: ignore[reportAttributeAccessIssue]
                instance, user=self.request.user, **data
            )

    def _guard_initial_status(self, data):
        """Creating a record straight in a privileged status needs its code."""
        key = self.workflow_key
        if key and data.get("status"):
            StatusService.check_initial(entity_key=key, to_status=data["status"], has_permission=self.can)

    def _set_status(self, instance, value):
        """Archive/restore bookkeeping: a status change with history, no map check."""
        if self.workflow_key:
            choices = {choice[0] for choice in (instance._meta.get_field("status").choices or [])}
            if value in choices:
                StatusService.transition_status(
                    actor=self.request.user, entity=instance, to_status=value, enforce=False
                )
                return
        parent = getattr(super(), "_set_status", None)
        if parent is not None:
            parent(instance, value)

    def prepare_create(self, serializer, project):
        """
        Hook: resolve and validate what depends on the project before saving.

        Runs after the project is resolved and authorized, for single create and
        for every item of a bulk create. May rewrite ``serializer.validated_data``
        (e.g. resolve references); raise a ``ValidationError`` to refuse.
        """

    def validate_references(self, project, data, instance=None):
        """
        Hook: check that the records ``data`` points at belong to ``project``.

        Called on create (after the project is resolved and authorized) and on
        update (with the stored project). Raise a ``ValidationError`` that looks
        like an unknown id (``apps.production.validators.references``).
        """

    def _guard_privileged_values(self, data, instance=None):
        """403 when ``data`` sets or clears a privileged value without its code."""
        for field, rules in self.privileged_values.items():
            if field not in data:
                continue
            new = data[field]
            old = getattr(instance, field, None) if instance is not None else None
            for value, code in rules.items():
                if self._holds(new, value) != self._holds(old, value) and not has_permission_code(
                    self.request, code
                ):
                    raise PermissionDenied(f"Changing {field} to or from {value!r} requires {code}.")

    @staticmethod
    def _holds(stored: Any, value: Any) -> frozenset[Any]:
        """What ``stored`` carries of the privileged ``value``: the keys holding it for a dict, else ``{value}`` or nothing."""
        if isinstance(stored, dict):
            return frozenset(key for key, item in stored.items() if item == value)
        return frozenset({value}) if stored == value else frozenset()

    def _enforce_natural_key_uniqueness(self, project, data):
        """
        Fail closed on duplicate natural keys instead of 500ing.

        The write serializers skip unique-together validation for unresolved
        project references (mock ids/codes); by save time the project is
        resolved, so enforce the model's ``unique_together`` constraints
        here — including against soft-deleted rows (which the default
        manager hides and would otherwise explode as IntegrityError).
        Models without project-scoped unique constraints are unaffected.
        """
        model = self.get_queryset().model
        manager = getattr(model, "all_objects", model.objects)
        for unique_set in getattr(model._meta, "unique_together", None) or []:
            if "project" not in unique_set:
                continue
            lookup = {"project": project}
            complete = True
            for field_name in unique_set:
                if field_name == "project":
                    continue
                if field_name not in data:
                    complete = False
                    break
                # A code is unique whatever its case.
                key = f"{field_name}__iexact" if field_name == "code" else field_name
                lookup[key] = data[field_name]
            if not complete:
                continue
            if manager.filter(**lookup).first() is not None:
                raise ValidationError(
                    {unique_set[-1]: "A record with these values already exists."}
                )
