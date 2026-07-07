from rest_framework.decorators import action
from rest_framework.response import Response

from apps.identity.api.filtersets.user_session import (
    UserSessionFilterSet,
)
from apps.identity.api.serializers.user_session import (
    UserSessionDetailSerializer,
    UserSessionListSerializer,
)
from apps.identity.api.viewsets.base import (
    IdentityReadOnlyViewSet,
)
from apps.identity.constants.permissions import (
    UserSessionPermissions,
)
from apps.identity.models import (
    UserSession,
)
from apps.identity.selectors.user_session import (
    UserSessionSelector,
)
from apps.identity.services.user_session import (
    UserSessionService,
)


class UserSessionViewSet(
    IdentityReadOnlyViewSet,
):
    """
    Enterprise User Session API.

    Sessions are managed internally by the authentication
    subsystem and cannot be created, updated or deleted
    through the REST API.
    """

    queryset = UserSession.objects.all()

    selector_class = UserSessionSelector

    service_class = UserSessionService

    filterset_class = UserSessionFilterSet

    serializer_map = {
        "list": UserSessionListSerializer,
        "retrieve": UserSessionDetailSerializer,
    }

    permission_map = {
        "list": (UserSessionPermissions.VIEW,),
        "retrieve": (UserSessionPermissions.VIEW,),
        "current": (UserSessionPermissions.VIEW,),
        "my_sessions": (UserSessionPermissions.VIEW,),
        "logout": (UserSessionPermissions.LOGOUT,),
        "logout_all": (UserSessionPermissions.LOGOUT_ALL,),
        "logout_other_devices": (UserSessionPermissions.LOGOUT_ALL,),
        "revoke": (UserSessionPermissions.REVOKE,),
        "trust": (UserSessionPermissions.TRUST,),
        "refresh": (UserSessionPermissions.REFRESH,),
    }

    @action(
        detail=False,
        methods=["get"],
        url_path="current",
    )
    def current(
        self,
        request,
    ):
        session = self.selector_class.current(
            user=request.user,
        )

        serializer = UserSessionDetailSerializer(
            session,
        )

        return Response(
            serializer.data,
        )

    @action(
        detail=False,
        methods=["get"],
        url_path="my-sessions",
    )
    def my_sessions(
        self,
        request,
    ):
        queryset = self.selector_class.active_sessions(
            user=request.user,
        )

        serializer = UserSessionListSerializer(
            queryset,
            many=True,
        )

        return Response(
            serializer.data,
        )

    @action(
        detail=True,
        methods=["post"],
    )
    def logout(
        self,
        request,
        pk=None,
    ):
        session = self.get_object()

        self.service_class.logout(
            session,
        )

        return Response(
            {
                "detail": "Session logged out.",
            }
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="logout-all",
    )
    def logout_all(
        self,
        request,
    ):
        count = self.service_class.logout_all(
            user=request.user,
        )

        return Response(
            {
                "sessions": count,
            }
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="logout-other-devices",
    )
    def logout_other_devices(
        self,
        request,
    ):
        current = self.selector_class.current(
            user=request.user,
        )

        count = self.service_class.logout_other_devices(
            current_session=current,
        )

        return Response(
            {
                "sessions": count,
            }
        )

    @action(
        detail=True,
        methods=["post"],
    )
    def revoke(
        self,
        request,
        pk=None,
    ):
        session = self.get_object()

        self.service_class.revoke(
            session,
        )

        return Response(
            {
                "detail": "Session revoked.",
            }
        )

    @action(
        detail=True,
        methods=["post"],
    )
    def trust(
        self,
        request,
        pk=None,
    ):
        session = self.get_object()

        self.service_class.trust(
            session,
        )

        return Response(
            {
                "detail": "Session trusted.",
            }
        )
