"""
JSON validators.
"""

import json

from django.core.exceptions import ValidationError

from .base import BaseValidator


class JSONValidator(BaseValidator):

    message = "Invalid JSON."

    def validate(self, value):

        try:
            json.dumps(value)

        except Exception as exc:
            raise ValidationError(self.message) from exc
