"""
Password validators.
"""

from __future__ import annotations

import re

from django.core.exceptions import ValidationError

from .base import BaseValidator


class StrongPasswordValidator(BaseValidator):
    """
    Enforce strong password rules.
    """

    def validate(self, value):
        if len(value) < 8:
            raise ValidationError("Password must contain at least 8 characters.")

        if not re.search(r"[A-Z]", value):
            raise ValidationError("Password must contain an uppercase letter.")

        if not re.search(r"[a-z]", value):
            raise ValidationError("Password must contain a lowercase letter.")

        if not re.search(r"\d", value):
            raise ValidationError("Password must contain a number.")

        if not re.search(r"[^\w\s]", value):
            raise ValidationError("Password must contain a special character.")
