from rest_framework.decorators import action
from rest_framework.response import Response

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
from apps.identity.constants.permissions import (
    GroupPermissions,
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
        "activate": (GroupPermissions.ACTIVATE,),
        "deactivate": (GroupPermissions.DEACTIVATE,),
        "archive": (GroupPermissions.ARCHIVE,),
        "restore": (GroupPermissions.RESTORE,),
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
                "detail": "Group activated successfully.",
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
                "detail": "Group deactivated successfully.",
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
                "detail": "Group archived successfully.",
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
                "detail": "Group restored successfully.",
            },
        )
