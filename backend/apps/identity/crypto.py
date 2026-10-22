"""
Encryption of MFA secrets at rest (DOM-MFA-03, SEC-SEC-02).

Fernet (AES-128-CBC + HMAC-SHA256) with a dedicated key that is not
``SECRET_KEY``. ``settings.MFA_ENCRYPTION_KEYS`` is a tuple: the first key
encrypts, every key decrypts, so a key can be rotated by prepending a new
one. Everything here fails closed: a missing or malformed key, an
unencrypted stored value, a tampered token or a token made under an unknown
key raises ``SecretUnavailable``; nothing falls back to plaintext. Error
messages never include the value or the key.

This module deliberately imports no identity models so model fields can use it.
"""

from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings
from rest_framework import status
from rest_framework.exceptions import APIException

PREFIX = "enc:v1:"


class SecretUnavailable(APIException):
    """The MFA secret cannot be encrypted or decrypted right now."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Multi-factor authentication is temporarily unavailable."
    default_code = "mfa_secret_unavailable"


def _cipher() -> MultiFernet:
    keys: tuple[str, ...] = tuple(getattr(settings, "MFA_ENCRYPTION_KEYS", ()) or ())

    if not keys:
        raise SecretUnavailable()

    try:
        return MultiFernet([Fernet(key.encode()) for key in keys])
    except (ValueError, TypeError):
        raise SecretUnavailable() from None


def is_encrypted(value: str | None) -> bool:
    return bool(value) and str(value).startswith(PREFIX)


def encrypt(plaintext: str | None) -> str:
    """Encrypt a secret; the empty string stays empty (no secret stored)."""

    if not plaintext:
        return ""

    return PREFIX + _cipher().encrypt(plaintext.encode()).decode()


def decrypt(stored: str | None) -> str:
    """Decrypt a stored secret; refuses anything not encrypted by ``encrypt``."""

    if not stored:
        return ""

    if not is_encrypted(stored):
        # A plaintext value at rest is never trusted or returned.
        raise SecretUnavailable()

    try:
        return _cipher().decrypt(stored[len(PREFIX) :].encode()).decode()
    except (InvalidToken, ValueError):
        raise SecretUnavailable() from None
