"""
Position API viewset.
"""

from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.organization.api.filtersets.position import (
    PositionFilterSet,
)
from apps.organization.api.serializers.position import (
    PositionCreateSerializer,
    PositionDetailSerializer,
    PositionListSerializer,
    PositionUpdateSerializer,
)
from apps.organization.api.viewsets.base import (
    OrganizationEntityViewSet,
)
from apps.organization.api.viewsets.compat import IdOrCodeDetailMixin
from apps.organization.api.viewsets.context import OrganizationContextMixin
from apps.organization.constants.permissions import (
    PositionPermissions,
)
from apps.organization.models.position import (
    Position,
)
from apps.organization.selectors.position import (
    PositionSelector,
)
from apps.organization.services.position import (
    PositionService,
)


class PositionViewSet(
    OrganizationContextMixin,
    IdOrCodeDetailMixin,
    OrganizationEntityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    API endpoint for Position.
    """

    queryset = Position.objects.all()

    selector_class = PositionSelector
    service_class = PositionService

    filterset_class = PositionFilterSet

    serializer_map = {
        "list": PositionListSerializer,
        "retrieve": PositionDetailSerializer,
        "create": PositionCreateSerializer,
        "update": PositionUpdateSerializer,
        "partial_update": PositionUpdateSerializer,
    }

    pagination_class = StandardPagination

    permission_map = {
        "list": (PositionPermissions.VIEW,),
        "retrieve": (PositionPermissions.VIEW,),
        "available": (PositionPermissions.VIEW,),
        "create": (PositionPermissions.CREATE,),
        "update": (PositionPermissions.UPDATE,),
        "partial_update": (PositionPermissions.UPDATE,),
        "destroy": (PositionPermissions.DELETE,),
    }

    @action(detail=False, methods=["get"], url_path="available")
    def available(self, request, *args, **kwargs):
        """Org-scoped role catalog for the People-page role select.

        Returns the requesting organization's custom positions only —
        sibling-org customs are never included. With
        ``?include=all_masters`` the organization-agnostic global master
        catalog is appended.
        """
        customs = self.filter_queryset(self.get_queryset()).filter(
            scope=Position.Scope.ORGANIZATION_CUSTOM
        )
        positions = list(customs)
        if request.query_params.get("include") == "all_masters":
            positions.extend(
                Position.objects.filter(
                    organization__isnull=True,
                    scope=Position.Scope.GLOBAL_MASTER,
                )
            )
        serializer = self.get_serializer(positions, many=True)
        items = serializer.data
        for item in items:
            item["title"] = item.get("name")
            organization = item.get("organization")
            item["organization_id"] = str(organization) if organization is not None else None
        return Response(items)