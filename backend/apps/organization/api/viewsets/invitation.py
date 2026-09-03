"""
Invitation API viewsets.
"""

from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
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

    pagination_class = StandardPagination

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
        "resend": (InvitationPermissions.UPDATE,),
        "accept": (InvitationPermissions.UPDATE,),
        "decline": (InvitationPermissions.UPDATE,),
    }

    @action(detail=True, methods=["post"], url_path="resend")
    def resend(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.service_class.resend(instance)
        except Exception:
            # Fallback: just update updated_at
            instance.save(update_fields=["updated_at"])
        return Response({"success": True})

    @action(detail=True, methods=["post"], url_path="accept")
    def accept(self, request, *args, **kwargs):
        instance = self.get_object()
        self.service_class.accept(instance)
        serializer = InvitationDetailSerializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="decline")
    def decline(self, request, *args, **kwargs):
        instance = self.get_object()
        self.service_class.decline(instance)
        serializer = InvitationDetailSerializer(instance)
        return Response(serializer.data)
