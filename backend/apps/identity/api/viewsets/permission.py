from apps.identity.api.filtersets.permission import (
    PermissionFilterSet,
)
from apps.identity.api.serializers.permission import (
    PermissionCreateSerializer,
    PermissionDetailSerializer,
    PermissionListSerializer,
    PermissionUpdateSerializer,
)
from apps.identity.api.viewsets.base import (
    IdentityViewSet,
)
from apps.identity.constants.permissions import (
    PermissionPermissions,
)
from apps.identity.models import (
    Permission,
)
from apps.identity.selectors.permission import (
    PermissionSelector,
)
from apps.identity.services.permission import (
    PermissionService,
)


class PermissionViewSet(
    IdentityViewSet,
):
    queryset = Permission.objects.all()

    selector_class = PermissionSelector

    service_class = PermissionService

    filterset_class = PermissionFilterSet

    serializer_map = {
        "list": PermissionListSerializer,
        "retrieve": PermissionDetailSerializer,
        "create": PermissionCreateSerializer,
        "update": PermissionUpdateSerializer,
        "partial_update": PermissionUpdateSerializer,
    }

    permission_map = {
        "list": (PermissionPermissions.VIEW,),
        "retrieve": (PermissionPermissions.VIEW,),
        "create": (PermissionPermissions.CREATE,),
        "update": (PermissionPermissions.UPDATE,),
        "partial_update": (PermissionPermissions.UPDATE,),
        "destroy": (PermissionPermissions.DELETE,),
    }
