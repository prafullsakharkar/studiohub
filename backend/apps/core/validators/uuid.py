"""
UUID validators.
"""

from __future__ import annotations

import uuid

from django.core.exceptions import ValidationError

from .base import BaseValidator


class UUIDValidator(BaseValidator):

    message = "Invalid UUID."

    def validate(self, value):

        try:
            uuid.UUID(str(value))

        except Exception as exc:
            raise ValidationError(self.message) from exc
