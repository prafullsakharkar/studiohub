from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.identity.selectors.base import (
    IdentityBaseSelector,
)
from apps.identity.selectors.login_attempt import (
    LoginAttemptSelector,
)
from apps.identity.selectors.login_history import (
    LoginHistorySelector,
)
from apps.identity.selectors.user_session import (
    UserSessionSelector,
)

User = get_user_model()


class AuthenticationSelector(
    IdentityBaseSelector,
):
    """
    Read-only selector used by the authentication subsystem.
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
            username__iexact=username,
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
        return UserSessionSelector.current(
            user=user,
        )

    @classmethod
    def get_session_by_refresh_jti(
        cls,
        *,
        refresh_token_jti: str,
    ):
        return UserSessionSelector.by_refresh_jti(
            refresh_token_jti,
        )

    @classmethod
    def get_session_by_access_jti(
        cls,
        *,
        access_token_jti: str,
    ):
        return UserSessionSelector.by_access_jti(
            access_token_jti,
        )

    @classmethod
    def get_user_sessions(
        cls,
        *,
        user,
    ):
        return UserSessionSelector.active_sessions(
            user=user,
        )

    @classmethod
    def get_trusted_devices(
        cls,
        *,
        user,
    ):
        return UserSessionSelector.trusted_sessions(
            user=user,
        )

    @classmethod
    def get_login_history(
        cls,
        *,
        user,
    ):
        return LoginHistorySelector.for_user(
            user=user,
        )

    @classmethod
    def get_recent_login_attempts(
        cls,
        *,
        username: str,
        ip_address: str,
    ):
        return LoginAttemptSelector.failed_attempts(
            username=username,
            ip_address=ip_address,
        ).order_by("-created_at")

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
