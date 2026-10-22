from __future__ import annotations

import logging
from datetime import UTC

from django.conf import settings
from django.utils import timezone
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.identity.authentication.exceptions import (
    ExpiredToken,
    InvalidToken,
    RefreshTokenExpired,
    SessionRevoked,
)

logger = logging.getLogger(__name__)


class JWTService:
    """
    JWT helper service.

    Responsible for creating, validating,
    decoding and rotating JWT tokens.
    """

    access_token_class = AccessToken

    refresh_token_class = RefreshToken

    # ---------------------------------------------------------
    # Create
    # ---------------------------------------------------------

    @classmethod
    def create_refresh_token(
        cls,
        user,
        *,
        sid=None,
    ) -> RefreshToken:
        refresh = cls.refresh_token_class.for_user(
            user,
        )

        # ``sid`` is the stable identity of the session this token family
        # belongs to (the session_key). A new session's first token is its own
        # root; rotated tokens inherit it, so a replayed token can be traced
        # back to its session even though its jti is no longer on any row.
        refresh["sid"] = str(sid) if sid else str(refresh["jti"])

        profile = getattr(
            user,
            "profile",
            None,
        )

        if profile is not None:
            refresh["must_change_password"] = bool(
                profile.must_change_password,
            )

        return refresh

    @classmethod
    def create_access_token(
        cls,
        refresh: RefreshToken,
    ) -> AccessToken:
        return refresh.access_token

    @classmethod
    def create_token_pair(
        cls,
        user,
    ) -> tuple[str, str]:
        refresh = cls.create_refresh_token(
            user,
        )

        access = cls.create_access_token(
            refresh,
        )

        return (
            str(access),
            str(refresh),
        )

    # ---------------------------------------------------------
    # Decode
    # ---------------------------------------------------------

    @classmethod
    def decode_access_token(
        cls,
        token: str,
    ) -> AccessToken:
        try:
            return cls.access_token_class(
                token,
            )

        except TokenError as exc:
            raise cls._translate_token_error(exc, refresh=False) from exc

    @classmethod
    def decode_refresh_token(
        cls,
        token: str,
    ) -> RefreshToken:
        try:
            return cls.refresh_token_class(
                token,
            )

        except TokenError as exc:
            if "blacklist" in str(exc).lower():
                cls._revoke_session_on_reuse(token)

            raise cls._translate_token_error(exc, refresh=True) from exc

    @classmethod
    def _revoke_session_on_reuse(cls, token: str) -> None:
        """
        A refresh token that was already rotated has been presented again.

        Either a client raced itself or the token was stolen and replayed;
        the server cannot tell which, so the whole session is revoked. Only a
        token whose signature and expiry still verify is trusted to name a
        session, and only an ACTIVE session is touched (a token blacklisted by
        logout or revocation is just stale). Never raises: the caller still
        answers 401.

        This runs outside any request transaction (ATOMIC_REQUESTS is off);
        enabling it would roll the revocation back together with the 401.
        """
        try:
            from rest_framework_simplejwt.state import token_backend

            payload = token_backend.decode(
                token,  # pyright: ignore[reportArgumentType]
                verify=True,
            )
            sid = payload.get("sid")

            if not sid:
                return

            from apps.identity.choices import SecurityEventType
            from apps.identity.models import UserSession
            from apps.identity.services.security_event import (
                SecurityEventService,
            )
            from apps.identity.services.user_session import UserSessionService

            session = (
                UserSession.objects.active()
                .filter(session_key=str(sid))
                .select_related("user")
                .first()
            )

            if session is None:
                return

            UserSessionService.revoke(session)

            SecurityEventService.emit(
                user=session.user,
                event_type=SecurityEventType.SUSPICIOUS_ACTIVITY,
                description="Refresh token reuse detected; session revoked.",
                metadata={"session_id": str(session.pk)},
            )
        except Exception:  # noqa: BLE001 - detection must never mask the 401
            logger.exception("refresh_reuse_revocation_failed")

    @classmethod
    def _translate_token_error(
        cls,
        exc: TokenError,
        *,
        refresh: bool,
    ):
        """
        Preserve the failure cause instead of collapsing every token
        problem into a generic ``InvalidToken``.

        Distinct subclasses let the API diagnostics (and clients) tell
        expired credentials apart from revoked ones without parsing
        message text.
        """

        try:
            message = str(exc).lower()
        except Exception:
            message = ""

        if "expir" in message:
            if refresh:
                return RefreshTokenExpired()

            return ExpiredToken()

        if "blacklist" in message or "revok" in message:
            return SessionRevoked()

        return InvalidToken()

    # ---------------------------------------------------------
    # Validation
    # ---------------------------------------------------------

    @classmethod
    def validate_access_token(
        cls,
        token: str,
    ) -> AccessToken:
        return cls.decode_access_token(
            token,
        )

    @classmethod
    def validate_refresh_token(
        cls,
        token: str,
    ) -> RefreshToken:
        return cls.decode_refresh_token(
            token,
        )

    # ---------------------------------------------------------
    # Rotation
    # ---------------------------------------------------------

    @classmethod
    def rotate_refresh_token(
        cls,
        refresh_token: str,
        *,
        sid=None,
    ) -> tuple[RefreshToken, AccessToken]:
        refresh = cls.validate_refresh_token(
            refresh_token,
        )

        # simplejwt RefreshToken does not expose .user; resolve via payload.
        user_id = cls.get_user_id(refresh)
        if not user_id:
            raise InvalidToken("Refresh token has no user claim.")

        from django.contrib.auth import get_user_model

        User = get_user_model()
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist as exc:
            raise InvalidToken("User not found for refresh token.") from exc

        new_refresh = cls.refresh_token_class.for_user(user)

        # Tokens issued before ``sid`` existed get it from the session row.
        carried_sid = sid or refresh.get("sid")
        if carried_sid:
            new_refresh["sid"] = str(carried_sid)

        access = new_refresh.access_token

        # Optionally blacklist old refresh when rotation is enabled.
        # Rotation must not fail when the blacklist store is unavailable,
        # but the failure must be observable — never silently swallowed.
        try:
            refresh.blacklist()
        except Exception as exc:
            logger.warning(
                "Failed to blacklist rotated refresh token (jti=%s): %s",
                refresh.get("jti", "unknown"),
                exc,
            )

        return (
            new_refresh,
            access,
        )

    # ---------------------------------------------------------
    # Claims
    # ---------------------------------------------------------

    @staticmethod
    def get_user_id(
        token,
    ):
        # Use simplejwt api_settings to respect defaults even if SIMPLE_JWT not in Django settings.
        try:
            from rest_framework_simplejwt.settings import api_settings

            claim = api_settings.USER_ID_CLAIM
        except Exception:
            claim = getattr(settings, "SIMPLE_JWT", {}).get("USER_ID_CLAIM", "user_id")
        return token.get(claim)

    @staticmethod
    def get_jti(
        token,
    ):
        return token.get(
            "jti",
        )

    @staticmethod
    def get_expiration(
        token,
    ):
        timestamp = token.get(
            "exp",
        )

        if not timestamp:
            return None

        return timezone.datetime.fromtimestamp(
            timestamp,
            tz=UTC,
        )

    @staticmethod
    def is_expired(
        token,
    ) -> bool:
        expires_at = JWTService.get_expiration(
            token,
        )

        if expires_at is None:
            return False

        return expires_at <= timezone.now()

    # ---------------------------------------------------------
    # Blacklist
    # ---------------------------------------------------------

    @classmethod
    def blacklist(
        cls,
        refresh_token: str,
    ):
        refresh = cls.validate_refresh_token(
            refresh_token,
        )

        try:
            refresh.blacklist()
        except AttributeError as exc:
            # A token that has no blacklist support (e.g. not an
            # OutstandingToken-backed instance) is not a hard failure; the
            # caller still gets the intended outcome. Log, never crash.
            logger.debug(
                "Refresh token does not support blacklisting (jti=%s): %s",
                refresh.get("jti", "unknown"),
                exc,
            )

    @classmethod
    def blacklist_sweep_for_user(
        cls,
        *,
        user,
    ) -> int:
        """
        Blacklist every outstanding refresh token of ``user``.

        Idempotent: sessions already blacklisted are skipped. Returns the
        number of refresh jtis swept. Access tokens cannot be blacklisted
        by simplejwt; session-status enforcement covers them (Task 13).
        """
        from apps.identity.models import UserSession

        rows = list(
            UserSession.objects.active()
            .by_user(user)
            .values_list("refresh_token_jti", "expires_at")
        )

        return sum(
            cls.blacklist_refresh_jti(user=user, jti=jti, expires_at=expires_at)
            for jti, expires_at in rows
        )

    @classmethod
    def blacklist_refresh_jti(cls, *, user, jti, expires_at=None) -> bool:
        """
        Blacklist one refresh jti. Idempotent; returns True when newly listed.

        ``expires_at`` is the token's own expiry. SimpleJWT's outstanding-token
        table requires it, and its periodic flush deletes expired rows, so the
        row may need to be recreated here. A token that has already expired is
        unusable and is not listed.
        """
        from rest_framework_simplejwt.token_blacklist.models import (
            BlacklistedToken,
            OutstandingToken,
        )

        if not jti:
            return False

        now = timezone.now()

        if expires_at is not None and expires_at <= now:
            return False

        if expires_at is None:
            expires_at = now + settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]

        outstanding, _ = OutstandingToken.objects.get_or_create(
            jti=jti,
            defaults={
                "user": user,
                "token": f"jti:{jti}",
                "expires_at": expires_at,
            },
        )
        _, created = BlacklistedToken.objects.get_or_create(
            token=outstanding,
        )
        return created
