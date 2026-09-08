"""
Base ViewSet for Production entities.
"""

from __future__ import annotations

from django.http import Http404

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
        if self._include_deleted():
            # Frontend contract: ?include_deleted / ?include_archived opts into
            # soft-deleted rows (still strictly organization scoped).
            qs = self.service_class.model.all_objects.all()
        else:
            qs = self.selector_class.get_queryset(
                request=self.request,
                view=self,
            )
        return ProductionBaseSelector.scope_by_request(
            qs,
            request=self.request,
            view=self,
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

    def resolve_organization(self, *, instance=None):
        """
        Resolve the owning organization for a create/update operation.

        Priority: the active request context, then the related project
        instance, then the authenticated user's first membership. Returns
        ``None`` when none can be resolved so the caller fails closed rather
        than assigning to an arbitrary organization.
        """
        org = getattr(self.request, "organization", None)
        if org is not None:
            return org
        if instance is not None:
            related = getattr(instance, "organization", None)
            if related is not None:
                return related
        if self.request.user.is_authenticated:
            from apps.organization.models import OrganizationMembership

            membership = OrganizationMembership.objects.filter(
                user=self.request.user
            ).first()
            if membership is not None:
                return membership.organization
        return None

    def perform_create(self, serializer):
        project = serializer.validated_data.get("project")
        org = self.resolve_organization(instance=project)
        if org is None:
            from rest_framework.exceptions import ValidationError

            raise ValidationError(
                {"organization": "An active organization is required."}
            )
        serializer.save(organization=org)
