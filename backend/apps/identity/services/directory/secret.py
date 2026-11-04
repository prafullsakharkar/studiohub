"""
Encryption of the directory service account's password at rest (ADR-0039 decision 3).

A dedicated key (``DIRECTORY_ENCRYPTION_KEYS``), never ``SECRET_KEY`` or the MFA key, with the
same fail-closed mechanics as the MFA and delivery secrets (``apps.core.security.fernet``).
"""

from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import APIException

from apps.core.security.fernet import FieldCipher


class DirectorySecretUnavailable(APIException):
    """The service password cannot be encrypted or decrypted right now."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "The directory password cannot be stored or read: no encryption key is set."
    default_code = "directory_secret_unavailable"


_cipher = FieldCipher(
    keys_setting="DIRECTORY_ENCRYPTION_KEYS",
    error=DirectorySecretUnavailable,
)

encrypt = _cipher.encrypt
decrypt = _cipher.decrypt
