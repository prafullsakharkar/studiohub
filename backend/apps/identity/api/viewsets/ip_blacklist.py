from rest_framework.decorators import action
from rest_framework.response import Response

from apps.identity.api.filtersets.ip_blacklist import (
    IPBlacklistFilterSet,
)
from apps.identity.api.serializers.ip_blacklist import (
    IPBlacklistCreateSerializer,
    IPBlacklistDetailSerializer,
    IPBlacklistListSerializer,
    IPBlacklistUpdateSerializer,
)
from apps.identity.api.viewsets.base import (
    IdentityViewSet,
)
from apps.identity.constants.permissions import (
    IPBlacklistPermissions,
)
from apps.identity.models import (
    IPBlacklist,
)
from apps.identity.selectors.ip_blacklist import (
    IPBlacklistSelector,
)
from apps.identity.services.ip_blacklist import (
    IPBlacklistService,
)


class IPBlacklistViewSet(
    IdentityViewSet,
):

    queryset = IPBlacklist.objects.all()

    selector_class = IPBlacklistSelector

    service_class = IPBlacklistService

    filterset_class = IPBlacklistFilterSet

    serializer_map = {
        "list": IPBlacklistListSerializer,
        "retrieve": IPBlacklistDetailSerializer,
        "create": IPBlacklistCreateSerializer,
        "update": IPBlacklistUpdateSerializer,
        "partial_update": IPBlacklistUpdateSerializer,
    }

    permission_map = {
        "list": (IPBlacklistPermissions.VIEW,),
        "retrieve": (IPBlacklistPermissions.VIEW,),
        "create": (IPBlacklistPermissions.CREATE,),
        "update": (IPBlacklistPermissions.UPDATE,),
        "partial_update": (IPBlacklistPermissions.UPDATE,),
        "destroy": (IPBlacklistPermissions.DELETE,),
    }

    @action(
        detail=True,
        methods=[
            "post",
        ],
    )
    def activate(
        self,
        request,
        uuid=None,
    ):
        ip_blacklist = self.get_object()

        IPBlacklistService.activate(ip_blacklist)

        serializer = self.get_serializer(ip_blacklist)

        return Response(serializer.data)

    @action(
        detail=True,
        methods=[
            "post",
        ],
    )
    def deactivate(
        self,
        request,
        uuid=None,
    ):
        ip_blacklist = self.get_object()

        IPBlacklistService.deactivate(ip_blacklist)

        serializer = self.get_serializer(ip_blacklist)

        return Response(serializer.data)

    @action(
        detail=True,
        methods=[
            "post",
        ],
    )
    def expire(
        self,
        request,
        uuid=None,
    ):
        ip_blacklist = self.get_object()

        expires_at = request.data.get("expires_at")

        IPBlacklistService.update(
            ip_blacklist,
            expires_at=expires_at,
        )

        serializer = self.get_serializer(ip_blacklist)

        return Response(serializer.data)
