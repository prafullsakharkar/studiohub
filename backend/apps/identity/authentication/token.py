from __future__ import annotations

import contextlib

from django.utils import timezone

from apps.identity.authentication.jwt import JWTService
from apps.identity.authentication.utils import AuthenticationUtils
from apps.identity.choices import AuthenticationMethod, LogoutReason


class TokenService:
    """
    Enterprise Token Service.

    Responsible for:
    - JWT generation
    - JWT rotation
    - Session creation
    - Session synchronization
    - Token revocation
    """

    @classmethod
    def create_session(
        cls,
        *,
        request,
        user,
        organization=None,
        office=None,
        department=None,
        team=None,
        authentication_method=AuthenticationMethod.PASSWORD,
    ):
        # ``organization``/``office``/``department``/``team`` are accepted
        # for backwards compatibility but ignored: sessions are
        # platform-global and carry no org context.
        from apps.identity.services.login_history import LoginHistoryService
        from apps.identity.services.user_session import UserSessionService

        access_token, refresh_token = JWTService.create_token_pair(
            user,
        )

        access = JWTService.decode_access_token(
            access_token,
        )

        refresh = JWTService.decode_refresh_token(
            refresh_token,
        )

        session_data = AuthenticationUtils.build_session_data(
            request,
        )

        session = UserSessionService.create_login_session(
            user=user,
            authentication_method=authentication_method,
            session_key=refresh["jti"],
            access_token_jti=JWTService.get_jti(access),
            refresh_token_jti=JWTService.get_jti(refresh),
            expires_at=JWTService.get_expiration(refresh),
            **session_data,
        )

        LoginHistoryService.create(
            user=user,
            session=session,
            ip_address=session.ip_address,
            user_agent=session.user_agent,
            browser=session.browser,
            operating_system=session.operating_system,
            device_name=session.device_name,
            device_type=session.device_type,
            login_at=timezone.now(),
        )

        return {
            "access": access_token,
            "refresh": refresh_token,
            "session": session,
        }

    @classmethod
    def refresh(
        cls,
        *,
        session,
        refresh_token: str,
    ):
        from django.db import transaction

        from apps.identity.services.user_session import UserSessionService

        with transaction.atomic():
            new_refresh, new_access = JWTService.rotate_refresh_token(
                refresh_token,
            )

            UserSessionService.refresh(
                session,
                access_token_jti=JWTService.get_jti(
                    new_access,
                ),
                refresh_token_jti=JWTService.get_jti(
                    new_refresh,
                ),
            )

        return {
            "access": str(new_access),
            "refresh": str(new_refresh),
        }

    @classmethod
    def revoke(
        cls,
        *,
        session,
        refresh_token: str | None = None,
    ):
        from apps.identity.services.user_session import UserSessionService

        if refresh_token:
            JWTService.blacklist(
                refresh_token,
            )

        UserSessionService.revoke(
            session,
        )

    @classmethod
    def logout(
        cls,
        *,
        session,
        refresh_token: str | None = None,
    ):
        from apps.identity.services.user_session import UserSessionService

        if refresh_token:
            # Already blacklisted/rotated — logout stays idempotent.
            with contextlib.suppress(Exception):
                JWTService.blacklist(
                    refresh_token,
                )

        if session is not None:
            UserSessionService.logout(
                session,
            )

    @classmethod
    def logout_all(
        cls,
        *,
        user,
    ):
        from apps.identity.services.user_session import UserSessionService

        UserSessionService.logout_all(
            user=user,
        )

    @classmethod
    def revoke_all_for_user(
        cls,
        *,
        user,
        reason=LogoutReason.USER,
    ) -> int:
        from apps.identity.services.user_session import UserSessionService

        # Sweep refresh jtis BEFORE logout_all: the sweep only covers
        # active sessions, and logout_all flips them to LOGGED_OUT.
        swept = JWTService.blacklist_sweep_for_user(
            user=user,
        )

        UserSessionService.logout_all(
            user=user,
            reason=reason,
        )

        return swept

    @classmethod
    def logout_other_devices(
        cls,
        *,
        current_session,
    ):
        from apps.identity.services.user_session import UserSessionService

        UserSessionService.logout_other_devices(
            current_session=current_session,
        )

    @classmethod
    def validate_access(
        cls,
        token: str,
    ):
        return JWTService.validate_access_token(
            token,
        )

    @classmethod
    def validate_refresh(
        cls,
        token: str,
    ):
        return JWTService.validate_refresh_token(
            token,
        )
