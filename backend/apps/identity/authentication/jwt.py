from __future__ import annotations

import contextlib
from datetime import timedelta
from datetime import timezone as dt_timezone

from django.conf import settings
from django.utils import timezone
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.identity.authentication.exceptions import (
    ExpiredToken,
    InvalidToken,
)


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
    ) -> RefreshToken:
        return cls.refresh_token_class.for_user(
            user,
        )

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
            raise InvalidToken() from exc

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
            raise InvalidToken() from exc

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

        access = new_refresh.access_token

        # Optionally blacklist old refresh when rotation is enabled.
        with contextlib.suppress(Exception):
            refresh.blacklist()

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
            tz=dt_timezone.utc,
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

        with contextlib.suppress(AttributeError):
            refresh.blacklist()
