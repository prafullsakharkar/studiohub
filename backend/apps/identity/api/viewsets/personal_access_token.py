from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.identity.api.filtersets import (
    PersonalAccessTokenFilterSet,
)
from apps.identity.api.serializers.personal_access_token import (
    PersonalAccessTokenCreateSerializer,
    PersonalAccessTokenDetailSerializer,
    PersonalAccessTokenListSerializer,
    PersonalAccessTokenUpdateSerializer,
)
from apps.identity.models import (
    PersonalAccessToken,
)
from apps.identity.permissions.personal_access_token import (
    PersonalAccessTokenPermissions,
)
from apps.identity.selectors import (
    PersonalAccessTokenSelector,
)
from apps.identity.services import (
    PersonalAccessTokenService,
)

from .base import IdentityViewSet


class PersonalAccessTokenViewSet(
    IdentityViewSet,
):

    queryset = PersonalAccessToken.objects.none()

    selector_class = PersonalAccessTokenSelector

    service_class = PersonalAccessTokenService

    filterset_class = PersonalAccessTokenFilterSet

    serializer_map = {
        "list": PersonalAccessTokenListSerializer,
        "retrieve": PersonalAccessTokenDetailSerializer,
        "create": PersonalAccessTokenCreateSerializer,
        "update": PersonalAccessTokenUpdateSerializer,
        "partial_update": PersonalAccessTokenUpdateSerializer,
    }

    permission_map = {
        "list": (PersonalAccessTokenPermissions.VIEW,),
        "retrieve": (PersonalAccessTokenPermissions.VIEW,),
        "create": (PersonalAccessTokenPermissions.CREATE,),
        "update": (PersonalAccessTokenPermissions.UPDATE,),
        "partial_update": (PersonalAccessTokenPermissions.UPDATE,),
        "destroy": (PersonalAccessTokenPermissions.DELETE,),
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
        token = self.get_object()

        self.service_class.revoke(
            token,
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
        token = self.get_object()

        self.service_class.activate(
            token,
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
        token = self.get_object()

        token, plain_token = self.service_class.regenerate(
            token,
        )

        serializer = self.get_serializer(
            token,
        )

        return Response(
            {
                "token": plain_token,
                "personal_access_token": serializer.data,
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
        plain_token = request.data.get(
            "token",
        )

        token = self.service_class.verify(
            plain_token,
        )

        if token is None:
            return Response(
                {
                    "valid": False,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "valid": True,
                "uuid": str(token.uuid),
            }
        )
