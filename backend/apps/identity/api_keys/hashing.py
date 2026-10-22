from __future__ import annotations

import hashlib
import hmac

from django.conf import settings
from rest_framework import status
from rest_framework.exceptions import APIException

PREFIX_V2 = "v2$"


class CredentialSecretUnavailable(APIException):
    """No pepper is configured, so credential digests cannot be made."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Credential issuing is temporarily unavailable."
    default_code = "credential_secret_unavailable"


class APIKeyHasher:
    """
    Digest utilities for API keys and personal access tokens (A6).

    Current form: ``v2$`` + HMAC-SHA256(pepper, token). The pepper is a
    dedicated secret, so a database leak alone cannot be used to confirm a
    guessed token. Tokens are 48 random characters, so a fast keyed hash is
    appropriate (there is nothing to brute-force).

    The old form, unkeyed ``sha256(SECRET_KEY:token)``, is still *verified*
    while ``API_KEY_ACCEPT_LEGACY_HASH`` is on, so existing credentials keep
    working; callers upgrade them on first use (``needs_rehash``).

    Comparisons are constant-time; a missing pepper fails closed.
    """

    ALGORITHM = "hmac-sha256"

    @classmethod
    def _pepper(cls) -> bytes:
        pepper = getattr(settings, "API_KEY_PEPPER", "") or ""

        if not pepper:
            raise CredentialSecretUnavailable()

        return pepper.encode()

    @classmethod
    def hash(cls, value: str) -> str:
        digest = hmac.new(cls._pepper(), value.encode(), hashlib.sha256).hexdigest()

        return PREFIX_V2 + digest

    @classmethod
    def legacy_hash(cls, value: str) -> str:
        secret = getattr(settings, "SECRET_KEY", "")

        return hashlib.sha256(f"{secret}:{value}".encode()).hexdigest()

    @classmethod
    def is_legacy(cls, hashed: str) -> bool:
        return not hashed.startswith(PREFIX_V2)

    @classmethod
    def needs_rehash(cls, hashed: str) -> bool:
        return cls.is_legacy(hashed) and bool(getattr(settings, "API_KEY_PEPPER", ""))

    @classmethod
    def verify(
        cls,
        *,
        plain: str,
        hashed: str,
    ) -> bool:
        if not plain or not hashed:
            return False

        if not cls.is_legacy(hashed):
            try:
                expected = cls.hash(plain)
            except CredentialSecretUnavailable:
                return False

            return hmac.compare_digest(expected, hashed)

        if not getattr(settings, "API_KEY_ACCEPT_LEGACY_HASH", True):
            return False

        return hmac.compare_digest(cls.legacy_hash(plain), hashed)
