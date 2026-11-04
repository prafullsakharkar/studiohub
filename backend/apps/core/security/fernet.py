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

import logging

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)

PREFIX = "enc:v1:"

# Why a secret could not be used. Logged, never sent to the client: the response stays one generic
# message. Each text says what to check and carries no value or key.
REASONS = {
    "no_key": "no key is configured",
    "malformed_key": "a configured key is not a valid Fernet key",
    "plaintext_at_rest": "the stored value is not encrypted but encryption is on (convert it)",
    "undecryptable": "the stored value was made under another key or has been altered",
    "not_encrypted": "the stored value is not encrypted, so it cannot be rekeyed",
}


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

    def _fail(self, reason: str) -> APIException:
        """The cipher's error, after logging why (the reason code and the setting names only)."""
        logger.warning(
            "%s: secret unavailable, %s [%s; key setting %s]",
            self.error.__name__,
            REASONS[reason],
            reason,
            self.keys_setting,
        )
        return self.error()

    def _cipher(self) -> MultiFernet:
        keys: tuple[str, ...] = tuple(getattr(settings, self.keys_setting, ()) or ())
        if not keys:
            raise self._fail("no_key")
        try:
            return MultiFernet([Fernet(key.encode()) for key in keys])
        except (ValueError, TypeError):
            raise self._fail("malformed_key") from None

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

    def uses_primary_key(self, stored: str | None) -> bool:
        """Whether ``stored`` is already encrypted under the first (current) key."""
        keys: tuple[str, ...] = tuple(getattr(settings, self.keys_setting, ()) or ())
        if not keys or not self.is_encrypted(stored):
            return False
        try:
            Fernet(keys[0].encode()).decrypt(str(stored)[len(PREFIX) :].encode())
        except (InvalidToken, ValueError, TypeError):
            return False
        return True

    def rekey(self, stored: str) -> str:
        """
        Re-encrypt ``stored`` under the first key (any listed key may have made it), so the older
        keys can be removed from the setting once every value has been rekeyed.
        """
        if not self.is_encrypted(stored):
            raise self._fail("not_encrypted")
        try:
            return PREFIX + self._cipher().rotate(stored[len(PREFIX) :].encode()).decode()
        except (InvalidToken, ValueError):
            raise self._fail("undecryptable") from None

    def decrypt(self, stored: str | None) -> str:
        """Decrypt a stored secret; refuses anything not encrypted by ``encrypt``."""
        if not stored:
            return ""
        if not self.is_encrypted(stored):
            if not self.enabled():
                return stored
            # With encryption on, a plaintext value at rest is never trusted or returned.
            raise self._fail("plaintext_at_rest")
        try:
            return self._cipher().decrypt(stored[len(PREFIX) :].encode()).decode()
        except (InvalidToken, ValueError):
            raise self._fail("undecryptable") from None
