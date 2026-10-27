"""
Delivery passcode encryption (docs/deliveries/CONTRACTS.md DOM-DLV-09, SEC-DLV-02).

The ``passcode`` column holds ciphertext only. ``DELIVERY_SECRET_KEYS`` (settings, from
``DELIVERY_SECRET_KEY``) is a tuple: the first key encrypts, every key decrypts. Without a usable
key setting a passcode and reading one are a 503 ``secret_storage_unavailable``; clearing one is
not (nothing is encrypted). Nothing falls back to plaintext. The mechanics are
``apps.core.security.fernet``; this module imports no models so migrations can use it.
"""

from __future__ import annotations

from apps.core.security.fernet import FieldCipher
from apps.deliveries.exceptions import SecretStorageUnavailable

_cipher = FieldCipher(keys_setting="DELIVERY_SECRET_KEYS", error=SecretStorageUnavailable)

is_encrypted = _cipher.is_encrypted
encrypt = _cipher.encrypt
decrypt = _cipher.decrypt
