"""
Base ViewSet for Production entities.
"""

from __future__ import annotations

from apps.core.api.viewsets.service import ServiceModelViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.organization.middleware.organization_context import (
    resolve_organization_context,
)
from apps.production.selectors.base import ProductionBaseSelector


class ProductionEntityViewSet(ServiceModelViewSet):
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
        qs = self.selector_class.get_queryset(
            request=self.request,
            view=self,
        )
        return ProductionBaseSelector.scope_by_request(
            qs,
            request=self.request,
            view=self,
        )

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
