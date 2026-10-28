"""
Encryption of MFA secrets at rest (DOM-MFA-03, SEC-SEC-02).

Fernet (AES-128-CBC + HMAC-SHA256) with a dedicated key that is not
``SECRET_KEY``. ``settings.MFA_ENCRYPTION_KEYS`` is a tuple: the first key
encrypts, every key decrypts, so a key can be rotated by prepending a new
one. Encryption can be switched off by the operator (``MFA_ENCRYPTION_ENABLED``;
default on). While off, new secrets are stored as given and plaintext is read
back; values that are already encrypted still need the key. While on,
everything here fails closed: a missing or malformed key, an
unencrypted stored value, a tampered token or a token made under an unknown
key raises ``SecretUnavailable``; nothing falls back to plaintext. Error
messages never include the value or the key.

The mechanics are in ``apps.core.security.fernet``; this module fixes the key
settings and the error. It deliberately imports no identity models so model
fields can use it.
"""

from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import APIException

from apps.core.security.fernet import PREFIX, FieldCipher

__all__ = [
    "PREFIX",
    "SecretUnavailable",
    "decrypt",
    "enabled",
    "encrypt",
    "is_encrypted",
    "rekey",
    "uses_primary_key",
]


class SecretUnavailable(APIException):
    """The MFA secret cannot be encrypted or decrypted right now."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Multi-factor authentication is temporarily unavailable."
    default_code = "mfa_secret_unavailable"


_cipher = FieldCipher(
    keys_setting="MFA_ENCRYPTION_KEYS",
    enabled_setting="MFA_ENCRYPTION_ENABLED",
    error=SecretUnavailable,
)

enabled = _cipher.enabled
is_encrypted = _cipher.is_encrypted
encrypt = _cipher.encrypt
decrypt = _cipher.decrypt
rekey = _cipher.rekey
uses_primary_key = _cipher.uses_primary_key
