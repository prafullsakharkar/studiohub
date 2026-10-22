"""
Password validator.
"""

from __future__ import annotations

import re

from apps.identity.validators.base import IdentityBaseValidator


class PasswordValidator(IdentityBaseValidator):
    """Validator for passwords."""

    def validate(self, value: str) -> None:
        """Validate password strength."""
        from django.core.exceptions import ValidationError

        if len(value) < 8:
            raise ValidationError("Password must be at least 8 characters long.")

        if not re.search(r"[A-Z]", value):
            raise ValidationError("Password must contain at least one uppercase letter.")

        if not re.search(r"[a-z]", value):
            raise ValidationError("Password must contain at least one lowercase letter.")

        if not re.search(r"\d", value):
            raise ValidationError("Password must contain at least one digit.")

        if " " in value:
            raise ValidationError("Password must not contain spaces.")


def validate_password(value: str, user=None) -> None:
    """
    The single password policy.

    Identity's strength rules first, then Django's ``AUTH_PASSWORD_VALIDATORS``
    (length, similarity to the user's attributes, common and all-numeric
    passwords). Every path that sets a password goes through
    ``PasswordService``, which calls this, so create, change and reset cannot
    drift apart.
    """
    from django.contrib.auth.password_validation import (
        validate_password as django_validate_password,
    )

    PasswordValidator().validate(value)

    django_validate_password(value, user=user)
