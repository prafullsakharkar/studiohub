"""
Encryption of secrets at rest with Fernet (AES-128-CBC + HMAC-SHA256).

One cipher per kind of secret, each with its own key setting (never ``SECRET_KEY``). The setting
is a tuple: the first key encrypts, every key decrypts, so a key is rotated by putting a new one
first. Everything fails closed: a missing or malformed key, an unencrypted stored value, a
tampered token or a token made under an unknown key raises the cipher's ``error`` class; nothing
falls back to plaintext. Error messages never include the value or the key.

The module imports no models, so model fields and migrations can use it.
"""

from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings
from rest_framework.exceptions import APIException

PREFIX = "enc:v1:"


class FieldCipher:
    """
    Encrypts and decrypts one kind of stored secret.

    ``keys_setting`` names the settings tuple of keys. ``enabled_setting`` (optional) names a
    boolean setting an operator can switch off: new secrets are then stored as given and
    plaintext is read back, while already encrypted values still need the key.
    """

    def __init__(
        self,
        *,
        keys_setting: str,
        error: type[APIException],
        enabled_setting: str | None = None,
    ) -> None:
        self.keys_setting = keys_setting
        self.error = error
        self.enabled_setting = enabled_setting

    def _cipher(self) -> MultiFernet:
        keys: tuple[str, ...] = tuple(getattr(settings, self.keys_setting, ()) or ())
        if not keys:
            raise self.error()
        try:
            return MultiFernet([Fernet(key.encode()) for key in keys])
        except (ValueError, TypeError):
            raise self.error() from None

    def enabled(self) -> bool:
        """Whether new secrets are encrypted (always, when there is no switch)."""
        if self.enabled_setting is None:
            return True
        return bool(getattr(settings, self.enabled_setting, True))

    @staticmethod
    def is_encrypted(value: str | None) -> bool:
        return bool(value) and str(value).startswith(PREFIX)

    def encrypt(self, plaintext: str | None) -> str:
        """Encrypt a secret; the empty string stays empty (no secret stored)."""
        if not plaintext:
            return ""
        if not self.enabled():
            return plaintext
        return PREFIX + self._cipher().encrypt(plaintext.encode()).decode()

    def decrypt(self, stored: str | None) -> str:
        """Decrypt a stored secret; refuses anything not encrypted by ``encrypt``."""
        if not stored:
            return ""
        if not self.is_encrypted(stored):
            if not self.enabled():
                return stored
            # With encryption on, a plaintext value at rest is never trusted or returned.
            raise self.error()
        try:
            return self._cipher().decrypt(stored[len(PREFIX) :].encode()).decode()
        except (InvalidToken, ValueError):
            raise self.error() from None
