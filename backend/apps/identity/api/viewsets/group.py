from apps.identity.constants.permissions import (
    GroupPermissions,
)

from apps.identity.api.filtersets.group import (
    GroupFilterSet,
)
from apps.identity.api.serializers.group import (
    GroupCreateSerializer,
    GroupDetailSerializer,
    GroupListSerializer,
    GroupUpdateSerializer,
)
from apps.identity.api.viewsets.base import (
    IdentityViewSet,
)
from apps.identity.models import (
    Group,
)
from apps.identity.selectors.group import (
    GroupSelector,
)
from apps.identity.services.group import (
    GroupService,
)


class GroupViewSet(
    IdentityViewSet,
):
    """
    API endpoint for Group.
    """

    queryset = Group.objects.all()

    selector_class = GroupSelector

    service_class = GroupService

    filterset_class = GroupFilterSet

    serializer_map = {
        "list": GroupListSerializer,
        "retrieve": GroupDetailSerializer,
        "create": GroupCreateSerializer,
        "update": GroupUpdateSerializer,
        "partial_update": GroupUpdateSerializer,
    }

    permission_map = {
        "list": (GroupPermissions.VIEW,),
        "retrieve": (GroupPermissions.VIEW,),
        "create": (GroupPermissions.CREATE,),
        "update": (GroupPermissions.UPDATE,),
        "partial_update": (GroupPermissions.UPDATE,),
        "destroy": (GroupPermissions.DELETE,),
    }
