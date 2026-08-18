from apps.core.api.viewsets import ServiceModelViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.organization.api.filtersets import OrganizationFilterSet
from apps.organization.middleware.organization_context import (
    resolve_organization_context,
)
from apps.organization.api.serializers.organization import (
    OrganizationCreateSerializer,
    OrganizationDetailSerializer,
    OrganizationListSerializer,
    OrganizationUpdateSerializer,
)
from apps.organization.constants import OrganizationPermissions
from apps.organization.selectors import OrganizationSelector
from apps.organization.services import OrganizationService


class OrganizationViewSet(ServiceModelViewSet):
    """
    Organization API.
    """

    permission_classes = (
        IsAuthenticatedPermission,
        HasPermission,
    )

    selector_class = OrganizationSelector

    service_class = OrganizationService

    filterset_class = OrganizationFilterSet

    serializer_map = {
        "list": OrganizationListSerializer,
        "retrieve": OrganizationDetailSerializer,
        "create": OrganizationCreateSerializer,
        "update": OrganizationUpdateSerializer,
        "partial_update": OrganizationUpdateSerializer,
    }

    permission_map = {
        "list": (OrganizationPermissions.VIEW,),
        "retrieve": (OrganizationPermissions.VIEW,),
        "create": (OrganizationPermissions.CREATE,),
        "update": (OrganizationPermissions.UPDATE,),
        "partial_update": (OrganizationPermissions.UPDATE,),
        "destroy": (OrganizationPermissions.DELETE,),
    }

    def perform_authentication(self, request):
        """
        Resolve the organization context right after authentication.
        """
        response = super().perform_authentication(request)
        resolve_organization_context(request, force=True)
        return response

    def get_queryset(self):
        """
        Scope the Organization queryset by the user's memberships.

        The Organization model itself has no ``organization`` FK, so the
        generic ``scope_by_request`` does not apply. Users see the
        organizations they belong to; staff see everything.
        """
        qs = super().get_queryset()

        user = getattr(self.request, "user", None)

        if user is not None and (user.is_staff or user.is_superuser):
            return qs

        return qs.filter(memberships__user=user)
