from __future__ import annotations

import contextlib
from datetime import timedelta

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

        new_refresh = cls.refresh_token_class.for_user(
            refresh.user,
        )

        access = new_refresh.access_token

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
        return token.get(
            settings.SIMPLE_JWT["USER_ID_CLAIM"],
        )

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
            tz=timezone.utc,
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
