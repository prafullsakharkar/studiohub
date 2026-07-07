from __future__ import annotations

from django.contrib.auth import (
    login as django_login,
)
from django.contrib.auth import (
    logout as django_logout,
)

from apps.core.services.base import BusinessService
from apps.identity.authentication.token import (
    TokenService,
)
from apps.identity.authentication.utils import (
    AuthenticationUtils,
)
from apps.identity.events.authentication import (
    UserLoggedIn,
    UserLoggedOut,
    UserTokenRefreshed,
)
from apps.identity.selectors.authentication import (
    AuthenticationSelector,
)
from apps.identity.services.login_attempt import (
    LoginAttemptService,
)
from apps.identity.validators.authentication import (
    AuthenticationValidator,
)


class AuthenticationService(
    BusinessService,
):
    """
    Enterprise Authentication Service.
    """

    selector_class = AuthenticationSelector

    validator_class = AuthenticationValidator

    # ---------------------------------------------------------
    # Login
    # ---------------------------------------------------------

    @classmethod
    def login(
        cls,
        *,
        request,
        username: str,
        password: str,
        organization=None,
        office=None,
        department=None,
        team=None,
    ):
        ip_address = AuthenticationUtils.get_client_ip(
            request,
        )

        user = cls.selector_class.get_user(
            username=username,
        )

        cls.validator_class.validate_login(
            username=username,
            password=password,
            user=user,
            ip_address=ip_address,
        )

        django_login(
            request,
            user,
        )

        LoginAttemptService.success(
            username=username,
            ip_address=ip_address,
            request=request,
            user=user,
        )

        tokens = TokenService.create_session(
            request=request,
            user=user,
            organization=organization,
            office=office,
            department=department,
            team=team,
        )

        UserLoggedIn.dispatch(
            user=user,
            request=request,
        )

        return tokens

    # ---------------------------------------------------------
    # Logout
    # ---------------------------------------------------------

    @classmethod
    def logout(
        cls,
        *,
        request,
        session,
        refresh_token=None,
    ):
        cls.validator_class.validate_logout(
            session,
        )

        TokenService.logout(
            session=session,
            refresh_token=refresh_token,
        )

        django_logout(
            request,
        )

        UserLoggedOut.dispatch(
            user=session.user,
            request=request,
        )

    # ---------------------------------------------------------
    # Refresh
    # ---------------------------------------------------------

    @classmethod
    def refresh(
        cls,
        *,
        refresh_token: str,
    ):
        token = TokenService.validate_refresh(
            refresh_token,
        )

        session = cls.selector_class.get_session_by_refresh_jti(
            refresh_token_jti=token["jti"],
        )

        cls.validator_class.validate_refresh(
            session,
        )

        tokens = TokenService.refresh(
            session=session,
            refresh_token=refresh_token,
        )

        UserTokenRefreshed.dispatch(
            user=session.user,
            session=session,
        )

        return tokens

    # ---------------------------------------------------------
    # Sessions
    # ---------------------------------------------------------

    @classmethod
    def logout_all(
        cls,
        *,
        user,
    ):
        return TokenService.logout_all(
            user=user,
        )

    @classmethod
    def logout_other_devices(
        cls,
        *,
        current_session,
    ):
        return TokenService.logout_other_devices(
            current_session=current_session,
        )

    # ---------------------------------------------------------
    # User
    # ---------------------------------------------------------

    @classmethod
    def me(
        cls,
        *,
        user,
    ):
        return {
            "user": user,
            "current_session": cls.selector_class.get_active_session(
                user=user,
            ),
            "sessions": cls.selector_class.get_user_sessions(
                user=user,
            ),
            "trusted_devices": cls.selector_class.get_trusted_devices(
                user=user,
            ),
        }
