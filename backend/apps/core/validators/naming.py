"""
Naming validators.
"""

from django.core.exceptions import ValidationError

from .base import BaseValidator


class NameValidator(BaseValidator):

    def validate(self, value):

        if len(value.strip()) < 3:
            raise ValidationError("Name is too short.")

        if len(value) > 255:
            raise ValidationError("Name is too long.")
