import uuid

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.identity.api.serializers.user_session import (
    UserSessionBaseSerializer,
)
from apps.identity.api.viewsets.base import (
    IdentityViewSet,
)
from apps.identity.selectors.authentication import (
    AuthenticationSelector,
)
from apps.identity.selectors.user_session import (
    UserSessionSelector,
)
from apps.identity.services.user_session import (
    UserSessionService,
)
from apps.organization.models import (
    UserSession,
)


class UserSessionViewSet(
    IdentityViewSet,
):
    """
    Session management for the authenticated user.

    Standard actions are scoped to ``request.user``; the ``admin/*`` routes
    operate on any user and require staff privileges.
    """

    queryset = UserSession.objects.all()

    selector_class = UserSessionSelector

    serializer_class = UserSessionBaseSerializer

    admin_actions = (
        "admin_list",
        "admin_revoke_all",
    )

    def _is_admin(
        self,
        request,
    ):
        return request.user.is_staff or request.user.is_superuser

    @action(
        detail=False,
        methods=[
            "get",
        ],
    )
    def current(
        self,
        request,
    ):
        session = AuthenticationSelector.get_active_session(
            user=request.user,
        )

        if session is None:
            return Response(
                {
                    "detail": "No active session.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = self.get_serializer(
            session,
        )

        return Response(
            serializer.data,
        )

    @action(
        detail=True,
        methods=[
            "post",
        ],
    )
    def revoke(
        self,
        request,
        pk=None,
    ):
        session = self.get_object()

        UserSessionService.revoke(
            session,
        )

        return Response(
            {
                "detail": "Session revoked successfully.",
            },
        )

    @action(
        detail=False,
        methods=[
            "post",
        ],
        url_path="revoke-all-other",
    )
    def revoke_all_other(
        self,
        request,
    ):
        session = AuthenticationSelector.get_active_session(
            user=request.user,
        )

        if session is None:
            return Response(
                {
                    "detail": "No active session.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        count = UserSessionService.logout_other_devices(
            current_session=session,
        )

        return Response(
            {
                "sessions": count,
            },
        )

    @action(
        detail=True,
        methods=[
            "get",
        ],
        url_path="activity",
    )
    def activity(
        self,
        request,
        pk=None,
    ):
        session = self.get_object()

        activity = [
            {
                "timestamp": session.started_at.isoformat(),
                "action": "login",
            },
        ]

        if session.last_activity and session.last_activity != session.started_at:
            activity.append(
                {
                    "timestamp": session.last_activity.isoformat(),
                    "action": "activity",
                },
            )

        if session.logged_out_at:
            activity.append(
                {
                    "timestamp": session.logged_out_at.isoformat(),
                    "action": "logout",
                },
            )

        return Response(
            {
                "activity": activity,
            },
        )

    @action(
        detail=False,
        methods=[
            "get",
        ],
        url_path=r"admin/(?P<user_id>[^/.]+)",
    )
    def admin_list(
        self,
        request,
        user_id=None,
    ):
        if not self._is_admin(request):
            return Response(
                {
                    "detail": "You do not have permission to perform this action.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        sessions = self.get_queryset().filter(
            user_id=user_id,
        )

        page = self.paginate_queryset(sessions)

        if page is not None:
            serializer = self.get_serializer(page, many=True)

            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(sessions, many=True)

        return Response(serializer.data)

    @action(
        detail=False,
        methods=[
            "post",
        ],
        url_path=r"admin/(?P<user_id>[^/.]+)/revoke-all",
    )
    def admin_revoke_all(
        self,
        request,
        user_id=None,
    ):
        if not self._is_admin(request):
            return Response(
                {
                    "detail": "You do not have permission to perform this action.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        user = None

        try:
            user = AuthenticationSelector.get_user_by_id(
                pk=uuid.UUID(user_id),
            )
        except (ValueError, AttributeError, TypeError):
            user = None

        if user is None:
            return Response(
                {
                    "detail": "User not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        count = UserSessionService.logout_all(
            user=user,
        )

        return Response(
            {
                "sessions": count,
            },
        )
