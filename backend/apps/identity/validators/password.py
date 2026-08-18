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


def validate_password(value: str) -> None:
    """Validate password strength."""
    validator = PasswordValidator()
    validator.validate(value)
