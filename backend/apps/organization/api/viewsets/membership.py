"""
OrganizationMembership API viewsets.
"""

from apps.organization.api.filtersets.membership import OrganizationMembershipFilterSet
from apps.organization.api.serializers.membership import (
    OrganizationMembershipCreateSerializer,
    OrganizationMembershipDetailSerializer,
    OrganizationMembershipListSerializer,
    OrganizationMembershipUpdateSerializer,
)
from apps.organization.api.viewsets.base import OrganizationEntityViewSet
from apps.organization.constants.permissions import OrganizationMembershipPermissions
from apps.organization.models.membership import OrganizationMembership
from apps.organization.selectors.membership import OrganizationMembershipSelector
from apps.organization.services.membership import OrganizationMembershipService


class OrganizationMembershipViewSet(OrganizationEntityViewSet):
    """
    API endpoint for OrganizationMembership.
    """

    queryset = OrganizationMembership.objects.all()

    selector_class = OrganizationMembershipSelector
    service_class = OrganizationMembershipService

    filterset_class = OrganizationMembershipFilterSet

    search_fields = ()

    ordering = ("-created_at",)

    ordering_fields = (
        "created_at",
        "updated_at",
        "status",
        "joined_at",
        "left_at",
    )

    serializer_map = {
        "list": OrganizationMembershipListSerializer,
        "retrieve": OrganizationMembershipDetailSerializer,
        "create": OrganizationMembershipCreateSerializer,
        "update": OrganizationMembershipUpdateSerializer,
        "partial_update": OrganizationMembershipUpdateSerializer,
    }

    permission_map = {
        "list": (OrganizationMembershipPermissions.VIEW,),
        "retrieve": (OrganizationMembershipPermissions.VIEW,),
        "create": (OrganizationMembershipPermissions.CREATE,),
        "update": (OrganizationMembershipPermissions.UPDATE,),
        "partial_update": (OrganizationMembershipPermissions.UPDATE,),
        "destroy": (OrganizationMembershipPermissions.DELETE,),
    }
