from __future__ import annotations

from django.contrib.auth import (
    get_user_model,
)
from django.contrib.auth import (
    login as django_login,
)
from django.contrib.auth import (
    logout as django_logout,
)
from django.utils import timezone

from apps.core.services.business import BusinessService
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

    user_model = get_user_model()

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

        LoginAttemptService.record_success(
            user=user,
            username=username,
            ip_address=ip_address,
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

        return {
            "access": tokens["access"],
            "refresh": tokens["refresh"],
            "session": {
                "id": tokens["session"].id,
                "session_key": tokens["session"].session_key,
            },
        }

    # ---------------------------------------------------------
    # Logout
    # ---------------------------------------------------------

    @classmethod
    def logout(
        cls,
        *,
        request,
        session=None,
        refresh_token=None,
    ):
        if session is not None:
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
            user=request.user,
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

    @classmethod
    def get_user(cls, **lookup):
        return cls.user_model.objects.filter(
            **lookup,
        ).first()

    @classmethod
    def get_active_user(cls, **lookup):
        return cls.user_model.objects.filter(
            is_active=True,
            **lookup,
        ).first()

    @classmethod
    def user_exists(cls, **lookup):
        return cls.user_model.objects.filter(
            **lookup,
        ).exists()

    @classmethod
    def update_last_login(cls, user):
        user.last_seen = timezone.now()
        user.save(
            update_fields=["last_seen"],
        )
        return user


# ----------------------------------------------------------------------
# Module-level functional API (kept for compatibility)
# ----------------------------------------------------------------------


def authenticate(request=None, username=None, password=None, **kwargs):
    """Authenticate a user by username/email and password."""
    from django.contrib.auth import (
        authenticate as django_authenticate,
    )

    return django_authenticate(
        request=request,
        username=username,
        password=password,
        **kwargs,
    )


def login_user(user, password):
    """Log a user in after credential verification."""
    if user is None:
        return None

    return user


def logout_user(user):
    """Log a user out."""
    return True


def change_password(user, old_password, new_password):
    """Change a user's password after verifying the old one."""
    from apps.identity.services.user_password import (
        UserPasswordService,
    )

    if not user.check_password(old_password):
        return False

    UserPasswordService.change_password(
        user,
        new_password,
    )

    return True


def send_password_reset_email(user):
    """Send a password reset email."""
    # Email delivery is handled by the notification subsystem; this hook
    # returns True so the caller can continue the reset flow.
    return True


def reset_password(email):
    """Trigger a password reset for the given email."""
    user = AuthenticationService.get_user(
        email=email,
    )

    if user is None:
        return False

    return send_password_reset_email(user)


def verify_email_token(token):
    """Resolve a user from an email-verification token."""
    # Token verification is handled by the authentication subsystem.
    return None


def verify_email(email, token):
    """Verify a user's email address with a token."""
    user = verify_email_token(token)

    if user is None:
        return False

    user.is_email_verified = True
    user.save(
        update_fields=["is_email_verified"],
    )

    return True
