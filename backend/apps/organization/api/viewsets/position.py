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
    OrganizationEntityViewSet,
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

    permission_map = {
        "list": (PositionPermissions.VIEW,),
        "retrieve": (PositionPermissions.VIEW,),
        "create": (PositionPermissions.CREATE,),
        "update": (PositionPermissions.UPDATE,),
        "partial_update": (PositionPermissions.UPDATE,),
        "destroy": (PositionPermissions.DELETE,),
    }
