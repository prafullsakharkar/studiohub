from __future__ import annotations

from django.db import models

from apps.identity import crypto


class EncryptedSecretField(models.CharField):  # pyright: ignore[reportMissingTypeArgument]
    """
    A secret stored encrypted (see ``apps.identity.crypto``) and handled as
    plaintext in Python.

    Not queryable by value (every encryption differs). ``max_length`` bounds
    the *stored* form: a 32-character secret needs about 150 characters.
    """

    description = "Secret encrypted at rest"

    def from_db_value(self, value, expression, connection):
        return crypto.decrypt(value) if value else value

    def get_prep_value(self, value):
        value = super().get_prep_value(value)

        return crypto.encrypt(value) if value else value
