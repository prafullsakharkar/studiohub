from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.identity.selectors.base import (
    IdentityBaseSelector,
)
from apps.identity.selectors.login_attempt import (
    LoginAttemptSelector,
)
from apps.audit.models import LoginHistory
from apps.organization.models import (
    UserSession,
)

User = get_user_model()


class AuthenticationSelector(
    IdentityBaseSelector,
):
    """
    Read-only selector used by the authentication subsystem.

    Sessions and login history are owned by ``apps.organization``; identity
    reads them here to drive the authentication flows.
    """

    @classmethod
    def get_user(
        cls,
        *,
        username: str,
    ):
        """
        Get user by username or email.
        """

        username = username.strip()

        queryset = User.objects.all()

        if "@" in username:
            return queryset.filter(
                email__iexact=username,
            ).first()

        return queryset.filter(
            email__iexact=username,
        ).first()

    @classmethod
    def get_user_by_uuid(
        cls,
        *,
        uuid,
    ):
        return User.objects.filter(
            uuid=uuid,
        ).first()

    @classmethod
    def get_user_by_id(
        cls,
        *,
        pk,
    ):
        return User.objects.filter(
            pk=pk,
        ).first()

    @classmethod
    def get_active_session(
        cls,
        *,
        user,
    ):
        return (
            UserSession.objects.current()
            .by_user(user)
            .first()
        )

    @classmethod
    def get_session_by_refresh_jti(
        cls,
        *,
        refresh_token_jti: str,
    ):
        return (
            UserSession.objects.filter(
                refresh_token_jti=refresh_token_jti,
            )
            .select_related("user")
            .first()
        )

    @classmethod
    def get_session_by_access_jti(
        cls,
        *,
        access_token_jti: str,
    ):
        return (
            UserSession.objects.filter(
                access_token_jti=access_token_jti,
            )
            .select_related("user")
            .first()
        )

    @classmethod
    def get_user_sessions(
        cls,
        *,
        user,
    ):
        return (
            UserSession.objects.active()
            .by_user(user)
        )

    @classmethod
    def get_trusted_devices(
        cls,
        *,
        user,
    ):
        return (
            UserSession.objects.active()
            .trusted()
            .by_user(user)
        )

    @classmethod
    def get_login_history(
        cls,
        *,
        user,
    ):
        return (
            LoginHistory.objects.filter(
                user=user,
            )
        )

    @classmethod
    def get_recent_login_attempts(
        cls,
        *,
        username: str,
        ip_address: str,
    ):
        return (
            LoginAttemptSelector.failed_attempts(
                username=username,
                ip_address=ip_address,
            ).order_by("-created_at")
        )

    @classmethod
    def get_dashboard(
        cls,
        *,
        user,
    ):
        return {
            "current_session": cls.get_active_session(
                user=user,
            ),
            "active_sessions": cls.get_user_sessions(
                user=user,
            ),
            "trusted_devices": cls.get_trusted_devices(
                user=user,
            ),
            "login_history": cls.get_login_history(
                user=user,
            )[:10],
        }
