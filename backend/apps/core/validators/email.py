"""
Email validators.
"""

from __future__ import annotations

from django.core.exceptions import ValidationError
from django.core.validators import validate_email

from .base import BaseValidator


class EmailValidator(BaseValidator):
    """
    Email validator.
    """

    def validate(self, value):
        try:
            validate_email(value)
        except ValidationError as exc:
            raise ValidationError("Invalid email address.") from exc
