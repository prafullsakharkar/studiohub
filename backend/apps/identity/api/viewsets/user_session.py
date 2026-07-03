from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.viewsets import ServiceModelViewSet
from apps.identity.api.filtersets.user_session import (
    UserSessionFilterSet,
)
from apps.identity.api.serializers.user_session import (
    UserSessionCreateSerializer,
    UserSessionDetailSerializer,
    UserSessionListSerializer,
    UserSessionUpdateSerializer,
)
from apps.identity.permissions.user_session import (
    UserSessionPermissions,
)
from apps.identity.selectors.user_session import (
    UserSessionSelector,
)
from apps.identity.services.user_session import (
    UserSessionService,
)


class UserSessionViewSet(
    ServiceModelViewSet,
):

    queryset = UserSessionSelector.get_queryset()

    service = UserSessionService

    filterset_class = UserSessionFilterSet

    serializer_map = {
        "list": UserSessionListSerializer,
        "retrieve": UserSessionDetailSerializer,
        "create": UserSessionCreateSerializer,
        "update": UserSessionUpdateSerializer,
        "partial_update": UserSessionUpdateSerializer,
    }

    permission_map = {
        "list": (UserSessionPermissions.VIEW,),
        "retrieve": (UserSessionPermissions.VIEW,),
        "create": (UserSessionPermissions.CREATE,),
        "update": (UserSessionPermissions.UPDATE,),
        "partial_update": (UserSessionPermissions.UPDATE,),
        "destroy": (UserSessionPermissions.DELETE,),
    }

    @action(
        detail=True,
        methods=["post"],
        url_path="revoke",
    )
    def revoke(
        self,
        request,
        *args,
        **kwargs,
    ):

        session = self.get_object()

        UserSessionService.revoke(
            session,
            revoked_by=request.user,
        )

        return Response(
            {
                "detail": "Session revoked.",
            }
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="revoke-all",
    )
    def revoke_all(
        self,
        request,
    ):

        UserSessionService.revoke_all(
            user=request.user,
            revoked_by=request.user,
        )

        return Response(
            {
                "detail": "All sessions revoked.",
            }
        )
