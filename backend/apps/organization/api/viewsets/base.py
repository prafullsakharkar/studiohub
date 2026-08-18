"""
Base ViewSet for Organization entities.
"""

from apps.core.api.viewsets.service import ServiceModelViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.organization.middleware.organization_context import (
    resolve_organization_context,
)
from apps.organization.selectors.base import OrganizationBaseSelector


class OrganizationEntityViewSet(ServiceModelViewSet):
    """
    Base ViewSet for all Organization entities.

    Shared by:

        • Department
        • Team
        • Office
    """

    permission_classes = (
        IsAuthenticatedPermission,
        HasPermission,
    )

    lookup_field = "id"
    lookup_url_kwarg = "uuid"
    ordering = ("name",)

    search_fields = (
        "code",
        "name",
    )

    ordering_fields = (
        "code",
        "name",
        "created_at",
        "updated_at",
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
        return OrganizationBaseSelector.scope_by_request(
            qs,
            request=self.request,
            view=self,
        )
