"""
Base ViewSet for Production entities.
"""

from __future__ import annotations

from django.http import Http404
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from apps.core.api.viewsets.service import ServiceModelViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.production.selectors.base import ProductionBaseSelector


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
        qs = ProductionBaseSelector.scope_by_request(
            qs,
            request=self.request,
            view=self,
        )
        return ProductionBaseSelector.scope_by_project_membership(
            qs,
            request=self.request,
        )

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

    def _include_deleted(self):
        params = getattr(self.request, "query_params", {}) or {}
        for key in ("include_deleted", "include_archived"):
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

    @action(detail=False, methods=["get"], url_path="archived")
    def archived(self, request):
        """List soft-deleted records within the caller's project scope."""
        model = self.service_class.model
        qs = model.all_objects.filter(is_deleted=True)
        project_id = request.query_params.get("project_id")
        if project_id and hasattr(model, "project"):
            qs = qs.filter(project_id=project_id)
        qs = ProductionBaseSelector.scope_by_project_membership(qs, request=request)
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
        queryset = ProductionBaseSelector.scope_by_project_membership(
            model.objects.filter(
                pk=self.kwargs.get(self.lookup_url_kwarg or self.lookup_field),
            ),
            request=request,
        )
        instance = queryset.first()
        if instance is None:
            raise NotFound(f"{model.__name__} not found.")
        self._set_status(instance, "Archived")
        self.service_class.delete(instance, user=request.user)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        """Restore a soft-deleted record within the caller's project scope."""
        model = self.service_class.model
        queryset = ProductionBaseSelector.scope_by_project_membership(
            model.all_objects.filter(
                pk=self.kwargs.get(self.lookup_url_kwarg or self.lookup_field),
            ),
            request=request,
        )
        instance = queryset.first()
        if instance is None or not instance.is_deleted:
            raise NotFound(f"{model.__name__} not found.")
        serializer = self.get_serializer(
            self.service_class.restore(instance, user=request.user),
        )
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
            serializer.save()
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
        # Always pass the resolved instance: validated_data may carry the
        # raw reference string from the project_id/project_code aliases,
        # which the ORM cannot assign to the FK directly.
        serializer.save(project=project)

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
                lookup[field_name] = data[field_name]
            if not complete:
                continue
            if manager.filter(**lookup).first() is not None:
                raise ValidationError(
                    {unique_set[-1]: "A record with these values already exists."}
                )
