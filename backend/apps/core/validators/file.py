"""
File validators.
"""

from pathlib import Path

from django.core.exceptions import ValidationError

from .base import BaseValidator


class ExtensionValidator(BaseValidator):

    def __init__(self, *extensions):
        self.extensions = {ext.lower() for ext in extensions}

    def validate(self, value):

        suffix = Path(value.name).suffix.lower()

        if suffix not in self.extensions:
            raise ValidationError("Unsupported file extension.")
