from __future__ import annotations

from django.contrib.auth.hashers import check_password
from django.utils import timezone

from apps.identity.authentication.exceptions import (
    EmailNotVerified,
    ExpiredToken,
    InvalidCredentials,
    SessionExpired,
    SessionRevoked,
    TooManyLoginAttempts,
    UserInactive,
    UserLocked,
)
from apps.identity.choices import (
    SessionStatus,
)
from apps.identity.models import (
    LoginAttempt,
)
from apps.identity.validators.base import (
    IdentityBaseValidator,
)


class AuthenticationValidator(
    IdentityBaseValidator,
):
    """
    Enterprise Authentication Validator.
    """

    MAX_LOGIN_ATTEMPTS = 5
    # Throttle window: only failures inside this window count. Without a
    # window, stale failures accumulated permanently and locked accounts
    # forever (successes never reset the counter).
    MAX_LOGIN_ATTEMPT_WINDOW_MINUTES = 15

    # ---------------------------------------------------------
    # User
    # ---------------------------------------------------------

    @classmethod
    def validate_user_exists(
        cls,
        user,
    ):
        if user is None:
            raise InvalidCredentials()

    @classmethod
    def validate_user_active(
        cls,
        user,
    ):
        if not user.is_active:
            raise UserInactive()

    @classmethod
    def validate_email_verified(
        cls,
        user,
    ):
        # NOTE: fixed to reference the real ``is_email_verified`` field with
        # the correct polarity (was: nonexistent ``email_verified`` attr with
        # inverted logic, so it could never raise). Kept as an explicit
        # opt-in primitive — the login chain does NOT call it because email
        # verification is currently not a login gate (de facto contract:
        # factory/seed users log in unverified). Wire it into a flow only
        # when the product decides to enforce verification.
        if not getattr(user, "is_email_verified", False):
            raise EmailNotVerified()

    @classmethod
    def validate_user_locked(
        cls,
        user,
    ):
        if hasattr(user, "is_locked") and user.is_locked:
            raise UserLocked()

    @classmethod
    def validate_password(
        cls,
        *,
        password: str,
        user,
    ):
        if not check_password(
            password,
            user.password,
        ):
            raise InvalidCredentials()

    # ---------------------------------------------------------
    # Login Attempt
    # ---------------------------------------------------------

    @classmethod
    def validate_login_attempts(
        cls,
        *,
        username: str,
        ip_address: str,
    ):
        failed_attempts = (
            LoginAttempt.objects.failed()
            .filter(
                username=username,
                ip_address=ip_address,
            )
            .recent(cls.MAX_LOGIN_ATTEMPT_WINDOW_MINUTES)
            .count()
        )

        if failed_attempts >= cls.MAX_LOGIN_ATTEMPTS:
            raise TooManyLoginAttempts()

    # ---------------------------------------------------------
    # Session
    # ---------------------------------------------------------

    @classmethod
    def validate_session(
        cls,
        session,
    ):
        cls.check_not_none(session, "Session not found.")

        if session.status == SessionStatus.REVOKED:
            raise SessionRevoked()

        if session.status == SessionStatus.EXPIRED:
            raise SessionExpired()

        if session.expires_at and session.expires_at <= timezone.now():
            raise SessionExpired()

    @classmethod
    def validate_refresh(
        cls,
        session,
    ):
        cls.validate_session(
            session,
        )

    # ---------------------------------------------------------
    # Authentication
    # ---------------------------------------------------------

    @classmethod
    def validate_login(
        cls,
        *,
        username: str,
        password: str,
        user,
        ip_address: str,
    ):
        cls.validate_login_attempts(
            username=username,
            ip_address=ip_address,
        )

        cls.validate_user_exists(
            user,
        )

        cls.validate_user_active(
            user,
        )

        # NOTE: email verification is intentionally not enforced here (see
        # validate_email_verified). Verification state must not lock users
        # out of login until the product adopts it as a gate.

        cls.validate_user_locked(
            user,
        )

        cls.validate_password(
            password=password,
            user=user,
        )

    @classmethod
    def validate_logout(
        cls,
        session,
    ):
        cls.validate_session(
            session,
        )

    @classmethod
    def validate_access_token(
        cls,
        token,
    ):
        if token.is_expired():
            raise ExpiredToken()

    @classmethod
    def validate_refresh_token(
        cls,
        token,
    ):
        if token.is_expired():
            raise ExpiredToken()
