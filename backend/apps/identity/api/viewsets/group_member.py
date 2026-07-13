from rest_framework.decorators import action
from rest_framework.response import Response

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
from apps.identity.constants.permissions import (
    GroupMemberPermissions,
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
        "activate": (GroupMemberPermissions.ACTIVATE,),
        "deactivate": (GroupMemberPermissions.DEACTIVATE,),
        "archive": (GroupMemberPermissions.ARCHIVE,),
        "restore": (GroupMemberPermissions.RESTORE,),
    }

    @action(
        detail=True,
        methods=["post"],
    )
    def activate(
        self,
        request,
        uuid=None,
    ):
        instance = self.get_object()

        self.service_class.activate(
            instance,
        )

        return Response(
            {
                "detail": "Group member activated successfully.",
            },
        )

    @action(
        detail=True,
        methods=["post"],
    )
    def deactivate(
        self,
        request,
        uuid=None,
    ):
        instance = self.get_object()

        self.service_class.deactivate(
            instance,
        )

        return Response(
            {
                "detail": "Group member deactivated successfully.",
            },
        )

    @action(
        detail=True,
        methods=["post"],
    )
    def archive(
        self,
        request,
        uuid=None,
    ):
        instance = self.get_object()

        self.service_class.archive(
            instance,
        )

        return Response(
            {
                "detail": "Group member archived successfully.",
            },
        )

    @action(
        detail=True,
        methods=["post"],
    )
    def restore(
        self,
        request,
        uuid=None,
    ):
        instance = self.get_object()

        self.service_class.restore(
            instance,
        )

        return Response(
            {
                "detail": "Group member restored successfully.",
            },
        )
