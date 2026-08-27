"""
OrganizationMembership API viewsets.
"""

from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination

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

    pagination_class = StandardPagination

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
        "bulk_update": (OrganizationMembershipPermissions.UPDATE,),
    }

    @action(detail=False, methods=["post"], url_path="bulk-update")
    def bulk_update(self, request, *args, **kwargs):
        payload = request.data.get("memberships", [])
        updated = 0
        for item in payload:
            mid = item.get("id")
            data = item.get("data", {})
            if not mid:
                continue
            try:
                instance = self.get_queryset().get(pk=mid)
            except OrganizationMembership.DoesNotExist:
                continue
            serializer = OrganizationMembershipUpdateSerializer(instance, data=data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            updated += 1
        return Response({"updated": updated})
