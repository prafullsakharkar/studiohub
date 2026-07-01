"""
URL validators.
"""

from __future__ import annotations

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator

from .base import BaseValidator


class HttpURLValidator(BaseValidator):
    """
    Allow only HTTP/HTTPS URLs.
    """

    validator = URLValidator(schemes=["http", "https"])

    def validate(self, value):
        try:
            self.validator(value)
        except ValidationError as exc:
            raise ValidationError("Invalid URL.") from exc
