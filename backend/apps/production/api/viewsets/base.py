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
from apps.organization.middleware.organization_context import (
    resolve_organization_context,
)
from apps.production.selectors.base import ProductionBaseSelector


class ProductionEntityViewSet(ServiceModelViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """
    Base ViewSet for all Production organization-owned entities.

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

    Resolves the active organization immediately after authentication and
    strictly scopes every query to it (fail closed). Create operations resolve
    the owning organization from the active context, then the related project,
    then the user's membership — and fail closed instead of assigning to an
    arbitrary organization.
    """

    permission_classes = (
        IsAuthenticatedPermission,
        HasPermission,
    )

    def perform_authentication(self, request):
        """
        Resolve the organization context right after authentication.

        DRF's ``initial()`` performs authentication, then runs permission
        checks. Resolving the org context (header → Organization instance +
        membership) here guarantees it is available to ``HasPermission``
        before any permission check runs.
        """
        response = super().perform_authentication(request)
        resolve_organization_context(request, force=True)
        return response

    def get_queryset(self):
        resolve_organization_context(self.request)
        if self._include_deleted() and self._may_view_deleted():
            # Frontend contract: ?include_deleted / ?include_archived opts into
            # soft-deleted rows (still strictly organization scoped). Viewing
            # deleted rows requires the resource DELETE grant (or superuser);
            # otherwise the flag is ignored and live rows are returned.
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
        # ADR-0033 D1: per-project membership scoping on flat endpoints —
        # org membership alone never exposes project-scoped production data.
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
        organization = getattr(self.request, "organization", None)
        return all(
            PermissionCacheService.has_permission(
                user=user,
                permission=code,
                organization=organization,
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

    def _organization(self):
        """Active organization context; fail closed when missing."""
        org = getattr(self.request, "organization", None)
        if org is None:
            raise ValidationError({"organization": "An active organization is required."})
        return org

    # ------------------------------------------------------------------
    # Soft-delete archive listing / restore (BulkActionsMixin hooks)
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"], url_path="archived")
    def archived(self, request):
        """List soft-deleted records of the active organization."""
        if not hasattr(self.service_class, "get_archived"):
            raise NotFound("Archived listing not supported.")
        project_id = request.query_params.get("project_id")
        qs = self.service_class.get_archived(
            organization=self._organization(),
            project_id=project_id,
        )
        qs = ProductionBaseSelector.scope_by_project_membership(qs, request=request)
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        """Restore a soft-deleted record of the active organization."""
        model = self.service_class.model
        queryset = model.all_objects.filter(
            organization=self._organization(),
            pk=self.kwargs.get(self.lookup_url_kwarg or self.lookup_field),
        )
        queryset = ProductionBaseSelector.scope_by_project_membership(
            queryset,
            request=request,
        )
        instance = queryset.first()
        if instance is None or not instance.is_deleted:
            raise NotFound(f"{model.__name__} not found.")
        serializer = self.get_serializer(
            self.service_class.restore(instance, user=request.user),
        )
        return Response(serializer.data)

    def resolve_organization(self, *, instance=None):
        """
        Resolve the owning organization for a create/update operation.

        Priority: the active request context, then the related project
        instance. Returns ``None`` when neither resolves so the caller fails
        closed — never fall back to an arbitrary membership organization.
        """
        org = getattr(self.request, "organization", None)
        if org is not None:
            return org
        if instance is not None:
            related = getattr(instance, "organization", None)
            if related is not None:
                return related
        return None

    def _resolve_project_from_input(self, serializer):
        """
        Resolve the related project for a create operation.

        The frontend contract sends ``project_id`` (UUID string, real id or
        mock id) or ``project_code`` instead of the ``project`` PK field; the
        write serializers land those in ``validated_data["project"]`` as raw
        strings. Resolve org-scoped via the project selector (UUID/code/
        mock-id aware); fail closed with a 400 when a reference was supplied
        but resolves to nothing (including cross-organization ids). Returns
        None only when the input carried no project reference at all.
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
        resolved = ProjectSelector.resolve_by_lookup(
            getattr(self.request, "organization", None), ref
        )
        if resolved is None:
            raise ValidationError({"project_id": "Unknown project."})
        return resolved

    def perform_create(self, serializer):
        validated = serializer.validated_data
        data = validated if isinstance(validated, dict) else {}
        model = self.get_queryset().model
        if not hasattr(model, "project"):
            # Models without a project field (e.g., Project itself) don't need
            # project resolution; org is resolved from context directly.
            org = self.resolve_organization()
            if org is None:
                from rest_framework.exceptions import ValidationError

                raise ValidationError({"organization": "An active organization is required."})
            serializer.save(organization=org)
            return

        project = data.get("project")
        if project is None or isinstance(project, str):
            project = self._resolve_project_from_input(serializer)
        if project is None:
            from rest_framework.exceptions import ValidationError


            raise ValidationError({"project": "This field is required."})
        # ADR-0033 D1: creating into a project outside the caller's
        # membership/admin scope fails closed without an existence leak.
        if not ProductionBaseSelector.user_has_project_access(
            request=self.request,
            project=project,
        ):
            from rest_framework.exceptions import ValidationError


            raise ValidationError({"project_id": "Unknown project."})
        org = self.resolve_organization(instance=project)
        if org is None:
            from rest_framework.exceptions import ValidationError


            raise ValidationError(
                {"organization": "An active organization is required."}
            )
        self._enforce_natural_key_uniqueness(project, data)
        # Always pass the resolved instance: validated_data may carry the
        # raw reference string from the project_id/project_code aliases,
        # which the ORM cannot assign to the FK directly.
        serializer.save(organization=org, project=project)

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
                from rest_framework.exceptions import ValidationError


                raise ValidationError(
                    {unique_set[-1]: "A record with these values already exists."}
                )
