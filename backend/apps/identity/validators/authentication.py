from __future__ import annotations

from django.contrib.auth.hashers import (
    check_password,
    is_password_usable,
    make_password,
)
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

    _DUMMY_PASSWORD_HASH: str | None = None

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
    def validate_user_not_deleted(
        cls,
        user,
    ):
        """
        Soft-deleted principals are not authenticatable.

        The selector already excludes them; this is defense in depth for any
        caller that resolves a user through ``all_objects``.
        """

        if getattr(user, "is_deleted", False):
            raise InvalidCredentials()

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
        # Username-only keying: an attacker rotating source IPs must not
        # bypass the counter. ``ip_address`` is still accepted (and still
        # recorded per-attempt for forensics) but does not gate the count.
        failed_attempts = (
            LoginAttempt.objects.failed()
            .for_username(username)
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

        if session.status in (SessionStatus.REVOKED, SessionStatus.LOGGED_OUT):
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

        cls._validate_not_idle(session)

    @classmethod
    def _validate_not_idle(
        cls,
        session,
    ):
        """
        A session with no authenticated request for ``SESSION_IDLE_TIMEOUT_MINUTES`` ends here: it
        cannot be refreshed back to life by a token that sat in storage (TPN review TM-020).
        """
        from datetime import timedelta

        from django.conf import settings

        minutes = int(getattr(settings, "SESSION_IDLE_TIMEOUT_MINUTES", 0))

        if minutes <= 0 or session.last_activity is None:
            return

        if session.last_activity + timedelta(minutes=minutes) > timezone.now():
            return

        from apps.identity.services.user_session import UserSessionService

        UserSessionService.expire(session)

        raise SessionExpired()

    # ---------------------------------------------------------
    # Authentication
    # ---------------------------------------------------------

    @classmethod
    def _dummy_hash(cls) -> str:
        """
        Hash compared against when there is no usable stored password.

        Built once per process with the configured primary hasher so the
        work factor matches real accounts and unknown-user logins cost the
        same as wrong-password logins.
        """

        if cls._DUMMY_PASSWORD_HASH is None:
            cls._DUMMY_PASSWORD_HASH = make_password(
                "dummy-password-used-only-for-timing",
            )

        return cls._DUMMY_PASSWORD_HASH

    @classmethod
    def validate_login(
        cls,
        *,
        username: str,
        password: str,
        user,
        ip_address: str,
    ):
        """
        Validate credentials without revealing which part failed.

        Every call performs exactly one password-hash comparison, whether or
        not the account exists, so response time does not disclose account
        existence. Account state (deleted / inactive / locked) is checked
        only after the comparison and surfaces as the same generic failure;
        the precise cause is carried on ``InvalidCredentials.internal_reason``
        for the login-attempt ledger.
        """

        cls.validate_login_attempts(
            username=username,
            ip_address=ip_address,
        )

        stored_hash = (
            user.password if user is not None and is_password_usable(user.password) else None
        )

        password_ok = check_password(
            password,
            stored_hash or cls._dummy_hash(),
        )

        # NOTE: email verification is intentionally not enforced here (see
        # validate_email_verified). Verification state must not lock users
        # out of login until the product adopts it as a gate.

        reason = None

        if user is None:
            reason = "unknown_user"
        elif stored_hash is None or not password_ok:
            reason = "invalid_password"
        elif getattr(user, "is_deleted", False):
            reason = "user_deleted"
        elif not user.is_active:
            reason = "user_inactive"
        elif getattr(user, "is_locked", False):
            reason = "user_locked"

        if reason is not None:
            raise InvalidCredentials(reason=reason)

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
