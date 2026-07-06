from apps.identity.constants.permissions import (
    GroupMemberPermissions,
)

from apps.identity.api.filtersets.group_member import (
    GroupMemberFilterSet,
)
from apps.identity.api.serializers.group_member import (
    GroupMemberCreateSerializer,
    GroupMemberDetailSerializer,
    GroupMemberListSerializer,
    GroupMemberUpdateSerializer,
)
from apps.identity.api.viewsets.base import (
    IdentityViewSet,
)
from apps.identity.models import (
    GroupMember,
)
from apps.identity.selectors.group_member import (
    GroupMemberSelector,
)
from apps.identity.services.group_member import (
    GroupMemberService,
)


class GroupMemberViewSet(
    IdentityViewSet,
):
    """
    API endpoint for GroupMember.
    """

    queryset = GroupMember.objects.all()

    selector_class = GroupMemberSelector

    service_class = GroupMemberService

    filterset_class = GroupMemberFilterSet

    serializer_map = {
        "list": GroupMemberListSerializer,
        "retrieve": GroupMemberDetailSerializer,
        "create": GroupMemberCreateSerializer,
        "update": GroupMemberUpdateSerializer,
        "partial_update": GroupMemberUpdateSerializer,
    }

    permission_map = {
        "list": (GroupMemberPermissions.VIEW,),
        "retrieve": (GroupMemberPermissions.VIEW,),
        "create": (GroupMemberPermissions.CREATE,),
        "update": (GroupMemberPermissions.UPDATE,),
        "partial_update": (GroupMemberPermissions.UPDATE,),
        "destroy": (GroupMemberPermissions.DELETE,),
    }
