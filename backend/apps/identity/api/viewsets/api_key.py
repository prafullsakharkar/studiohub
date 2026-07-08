from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.identity.api.filtersets import APIKeyFilterSet
from apps.identity.api.serializers.api_key import (
    APIKeyCreateSerializer,
    APIKeyDetailSerializer,
    APIKeyListSerializer,
    APIKeyUpdateSerializer,
)
from apps.identity.models import APIKey
from apps.identity.permissions.api_key import (
    APIKeyPermissions,
)
from apps.identity.selectors import APIKeySelector
from apps.identity.services import APIKeyService

from .base import IdentityViewSet


class APIKeyViewSet(
    IdentityViewSet,
):

    queryset = APIKey.objects.none()

    selector_class = APIKeySelector

    service_class = APIKeyService

    filterset_class = APIKeyFilterSet

    serializer_map = {
        "list": APIKeyListSerializer,
        "retrieve": APIKeyDetailSerializer,
        "create": APIKeyCreateSerializer,
        "update": APIKeyUpdateSerializer,
        "partial_update": APIKeyUpdateSerializer,
    }

    permission_map = {
        "list": (APIKeyPermissions.VIEW,),
        "retrieve": (APIKeyPermissions.VIEW,),
        "create": (APIKeyPermissions.CREATE,),
        "update": (APIKeyPermissions.UPDATE,),
        "partial_update": (APIKeyPermissions.UPDATE,),
        "destroy": (APIKeyPermissions.DELETE,),
    }

    @action(
        detail=True,
        methods=["post"],
    )
    def revoke(
        self,
        request,
        *args,
        **kwargs,
    ):
        api_key = self.get_object()

        self.service_class.revoke(
            api_key,
        )

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )

    @action(
        detail=True,
        methods=["post"],
    )
    def activate(
        self,
        request,
        *args,
        **kwargs,
    ):
        api_key = self.get_object()

        self.service_class.activate(
            api_key,
        )

        return Response(
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
    )
    def regenerate(
        self,
        request,
        *args,
        **kwargs,
    ):
        api_key = self.get_object()

        api_key, token = self.service_class.regenerate(
            api_key,
        )

        serializer = self.get_serializer(
            api_key,
        )

        return Response(
            {
                "token": token,
                "api_key": serializer.data,
            }
        )

    @action(
        detail=False,
        methods=["post"],
    )
    def verify(
        self,
        request,
        *args,
        **kwargs,
    ):
        token = request.data.get(
            "token",
        )

        api_key = self.service_class.verify(
            token,
        )

        if api_key is None:
            return Response(
                {
                    "valid": False,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "valid": True,
                "uuid": str(api_key.uuid),
            }
        )
