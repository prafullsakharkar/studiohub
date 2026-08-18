"""
Invitation API viewsets.
"""

from apps.organization.api.filtersets.invitation import InvitationFilterSet
from apps.organization.api.serializers.invitation import (
    InvitationCreateSerializer,
    InvitationDetailSerializer,
    InvitationListSerializer,
    InvitationUpdateSerializer,
)
from apps.organization.api.viewsets.base import OrganizationEntityViewSet
from apps.organization.constants.permissions import InvitationPermissions
from apps.organization.models.invitation import Invitation
from apps.organization.selectors.invitation import InvitationSelector
from apps.organization.services.invitation import InvitationService


class InvitationViewSet(OrganizationEntityViewSet):
    """
    API endpoint for Invitation.
    """

    queryset = Invitation.objects.all()

    selector_class = InvitationSelector
    service_class = InvitationService

    filterset_class = InvitationFilterSet

    search_fields = ()

    ordering = ("-created_at",)

    ordering_fields = (
        "created_at",
        "updated_at",
        "status",
        "expires_at",
    )

    serializer_map = {
        "list": InvitationListSerializer,
        "retrieve": InvitationDetailSerializer,
        "create": InvitationCreateSerializer,
        "update": InvitationUpdateSerializer,
        "partial_update": InvitationUpdateSerializer,
    }

    permission_map = {
        "list": (InvitationPermissions.VIEW,),
        "retrieve": (InvitationPermissions.VIEW,),
        "create": (InvitationPermissions.CREATE,),
        "update": (InvitationPermissions.UPDATE,),
        "partial_update": (InvitationPermissions.UPDATE,),
        "destroy": (InvitationPermissions.DELETE,),
    }
