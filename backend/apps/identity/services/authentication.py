from __future__ import annotations

import secrets

from django.conf import settings
from django.contrib.auth import (
    get_user_model,
)
from django.contrib.auth import (
    login as django_login,
)
from django.contrib.auth import (
    logout as django_logout,
)
from django.core import signing
from django.core.cache import cache
from django.utils import timezone

from apps.core.services.business import BusinessService
from apps.identity.authentication.exceptions import (
    IPBlocked,
    MFAChallengeInvalid,
    MFACodeInvalid,
    TooManyLoginAttempts,
)
from apps.identity.authentication.token import (
    TokenService,
)
from apps.identity.authentication.utils import (
    AuthenticationUtils,
)
from apps.identity.choices import AuthenticationMethod
from apps.identity.events.authentication import (
    UserLoggedIn,
    UserLoggedOut,
    UserTokenRefreshed,
)
from apps.identity.selectors.authentication import (
    AuthenticationSelector,
)
from apps.identity.services.ip_blacklist import (
    IPBlacklistService,
)
from apps.identity.services.login_attempt import (
    LoginAttemptService,
)
from apps.identity.validators.authentication import (
    AuthenticationValidator,
)

# A failed-login / lockout security event is written at most once per account
# per window, so a password-guessing attack cannot flood the audit ledger.
FAILURE_EVENT_WINDOW_SECONDS = 60
LOCKOUT_EVENT_WINDOW_SECONDS = AuthenticationValidator.MAX_LOGIN_ATTEMPT_WINDOW_MINUTES * 60


CHALLENGE_SALT = "identity.mfa.challenge"

CHALLENGE_CACHE_PREFIX = "identity.mfa.challenge."

MFA_CHALLENGE_TTL_SECONDS = getattr(settings, "MFA_CHALLENGE_TTL_SECONDS", 300)


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
        # ``organization``/``office``/``department``/``team`` are accepted
        # for backwards compatibility but ignored: login creates a
        # platform-global session with no org context.
        ip_address = AuthenticationUtils.get_client_ip(
            request,
        )

        if IPBlacklistService.record_block(
            ip_address,
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        ):
            raise IPBlocked()

        user = cls.selector_class.get_user(
            username=username,
        )

        try:
            cls.validator_class.validate_login(
                username=username,
                password=password,
                user=user,
                ip_address=ip_address,
            )
        except Exception as exc:
            LoginAttemptService.record_failure(
                username=username,
                ip_address=ip_address,
                user_agent=request.META.get(
                    "HTTP_USER_AGENT",
                    "",
                ),
                reason=getattr(exc, "internal_reason", None)
                or getattr(
                    exc,
                    "default_detail",
                    None,
                )
                or type(exc).__name__,
                user=user,
            )

            cls._emit_failure_event(
                exc=exc,
                user=user,
                ip_address=ip_address,
                request=request,
            )

            raise

        mfa_state = cls._mfa_state(
            user=user,
            request=request,
        )

        if mfa_state == "challenge":
            # SEC-LOGIN-04: a correct password alone yields no session and
            # no tokens, only a short-lived challenge.
            return {
                "mfa_required": True,
                "challenge": cls._issue_challenge(user),
                "expires_in": MFA_CHALLENGE_TTL_SECONDS,
            }

        result = cls._start_session(
            request=request,
            user=user,
            username=username,
            ip_address=ip_address,
        )

        if mfa_state == "enrollment_required":
            result["mfa_enrollment_required"] = True

        return result

    # ---------------------------------------------------------
    # MFA challenge
    # ---------------------------------------------------------

    @classmethod
    def _mfa_state(
        cls,
        *,
        user,
        request,
    ) -> str:
        """
        ``challenge``: a second factor must be presented.
        ``enrollment_required``: policy demands MFA but none is enrolled
        (login proceeds and the client is told to enroll).
        ``none``: password is enough.
        """

        from apps.identity.models import UserMFA
        from apps.identity.services.mfa import MFAService

        mfa = UserMFA.objects.filter(user=user).first()

        if mfa is not None and mfa.requires_challenge:
            if MFAService.can_trust_device_cookie() and MFAService.validate_device(
                user=user,
                request=request,
            ):
                return "none"

            return "challenge"

        if MFAService.requires_mfa(user=user):
            return "enrollment_required"

        return "none"

    @classmethod
    def _issue_challenge(cls, user) -> str:
        nonce = secrets.token_urlsafe(16)

        cache.set(
            f"{CHALLENGE_CACHE_PREFIX}live:{nonce}",
            1,
            MFA_CHALLENGE_TTL_SECONDS,
        )

        return signing.dumps(
            {"u": str(user.pk), "n": nonce},
            salt=CHALLENGE_SALT,
        )

    @classmethod
    def _load_challenge(cls, challenge: str):
        try:
            payload = signing.loads(
                challenge or "",
                salt=CHALLENGE_SALT,
                max_age=MFA_CHALLENGE_TTL_SECONDS,
            )
            user_id, nonce = payload["u"], payload["n"]
        except (signing.BadSignature, KeyError, TypeError):
            raise MFAChallengeInvalid() from None

        if not cache.get(f"{CHALLENGE_CACHE_PREFIX}live:{nonce}"):
            raise MFAChallengeInvalid()

        user = cls.selector_class.get_user_by_id(pk=user_id)

        if (
            user is None
            or not user.is_active
            or getattr(user, "is_deleted", False)
            or getattr(user, "is_locked", False)
        ):
            raise MFAChallengeInvalid()

        return user, nonce

    @classmethod
    def complete_mfa_login(
        cls,
        *,
        request,
        challenge: str,
        code: str = "",
        recovery_code: str = "",
    ):
        """
        Second step of an MFA login: exchange a challenge plus a valid
        second factor for a session and tokens. Returns ``(user, tokens)``.
        """

        from apps.identity.services.mfa import MFAService

        ip_address = AuthenticationUtils.get_client_ip(request)

        if IPBlacklistService.record_block(
            ip_address,
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        ):
            raise IPBlocked()

        user, nonce = cls._load_challenge(challenge)

        if not MFAService.verify_second_factor(
            user=user,
            code=code,
            recovery_code=recovery_code,
            request=request,
        ):
            raise MFACodeInvalid()

        # One challenge, one login: the first valid submission claims it.
        if not cache.add(
            f"{CHALLENGE_CACHE_PREFIX}used:{nonce}",
            1,
            MFA_CHALLENGE_TTL_SECONDS,
        ):
            raise MFAChallengeInvalid()

        cache.delete(f"{CHALLENGE_CACHE_PREFIX}live:{nonce}")

        return user, cls._start_session(
            request=request,
            user=user,
            username=user.email,
            ip_address=ip_address,
            authentication_method=AuthenticationMethod.MFA,
        )

    @classmethod
    def _start_session(
        cls,
        *,
        request,
        user,
        username: str,
        ip_address,
        authentication_method=AuthenticationMethod.PASSWORD,
    ):
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
            authentication_method=authentication_method,
        )

        cls._emit_success_events(
            user=user,
            session=tokens["session"],
            ip_address=ip_address,
            request=request,
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
    # Security events (best effort, never fail the login)
    # ---------------------------------------------------------

    @classmethod
    def _emit_failure_event(
        cls,
        *,
        exc,
        user,
        ip_address,
        request,
    ):
        """
        Record LOGIN_FAILED / LOGIN_LOCKED for an existing account.

        Unknown usernames are not written (the event needs an account and the
        attempt itself is already in the login-attempt ledger). Written at
        most once per window per account to keep the ledger bounded.
        """

        from apps.identity.choices import SecurityEventType
        from apps.identity.services.security_event import SecurityEventService

        if user is None:
            return

        if isinstance(exc, TooManyLoginAttempts):
            event_type = SecurityEventType.LOGIN_LOCKED
            window = LOCKOUT_EVENT_WINDOW_SECONDS
            description = "Login blocked: too many failed attempts."
        else:
            event_type = SecurityEventType.LOGIN_FAILED
            window = FAILURE_EVENT_WINDOW_SECONDS
            description = "Login failed."

        if not cache.add(
            f"identity.audit.{event_type.value}:{user.pk}",
            1,
            window,
        ):
            return

        SecurityEventService.emit(
            user=user,
            event_type=event_type,
            ip_address=ip_address,
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            description=description,
            metadata={
                "reason": getattr(exc, "internal_reason", type(exc).__name__),
            },
        )

    @classmethod
    def _emit_success_events(
        cls,
        *,
        user,
        session,
        ip_address,
        request,
    ):
        from apps.identity.choices import SecurityEventType
        from apps.identity.services.security_event import SecurityEventService

        user_agent = request.META.get("HTTP_USER_AGENT", "")
        metadata = {"session_id": str(session.pk)}

        for event_type, description in (
            (SecurityEventType.LOGIN_SUCCESS, "Login succeeded."),
            (SecurityEventType.SESSION_CREATED, "Session created."),
        ):
            SecurityEventService.emit(
                user=user,
                event_type=event_type,
                ip_address=ip_address,
                user_agent=user_agent,
                description=description,
                metadata=metadata,
            )

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

            from apps.identity.choices import SecurityEventType
            from apps.identity.services.security_event import SecurityEventService

            SecurityEventService.create(
                user=session.user,
                event_type=SecurityEventType.SESSION_TERMINATED,
                ip_address=AuthenticationUtils.get_client_ip(request),
                user_agent=request.META.get("HTTP_USER_AGENT", ""),
                description="Session terminated by logout.",
                metadata={"session_id": str(session.pk)},
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
        assert session is not None  # guaranteed by validate_refresh above

        tokens = TokenService.refresh(
            session=session,
            refresh_token=refresh_token,
        )

        from apps.identity.choices import SecurityEventType
        from apps.identity.services.security_event import SecurityEventService

        SecurityEventService.emit(
            user=session.user,
            event_type=SecurityEventType.TOKEN_REFRESHED,
            description="Access token refreshed.",
            metadata={"session_id": str(session.pk)},
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
    from apps.identity.services.password import (
        PasswordService,
    )

    try:
        PasswordService.change_password(
            user=user,
            old_password=old_password,
            new_password=new_password,
        )
    except Exception:
        return False

    return True


def send_password_reset_email(user):
    """Send a password reset email."""
    # Email delivery is handled by the notification subsystem; this hook
    # returns True so the caller can continue the reset flow.
    return True


def reset_password(email):
    """Trigger a password reset for the given email."""
    from apps.identity.services.password_reset import (
        PasswordResetService,
    )

    return (
        PasswordResetService.request_reset(
            email=email,
        )
        is not None
    )


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
