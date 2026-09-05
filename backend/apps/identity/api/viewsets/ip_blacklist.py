from rest_framework import status
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
        "activate": (IPBlacklistPermissions.UPDATE,),
        "deactivate": (IPBlacklistPermissions.UPDATE,),
        "expire": (IPBlacklistPermissions.UPDATE,),
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
        pk=None,
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
        pk=None,
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
        pk=None,
    ):
        from django.utils.dateparse import (
            parse_datetime,
        )

        ip_blacklist = self.get_object()

        expires_at = parse_datetime(
            request.data.get("expires_at") or "",
        )

        if expires_at is None:
            return Response(
                {
                    "detail": "A valid ISO-8601 expires_at is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        IPBlacklistService.update(
            ip_blacklist,
            expires_at=expires_at,
        )

        serializer = self.get_serializer(ip_blacklist)

        return Response(serializer.data)
