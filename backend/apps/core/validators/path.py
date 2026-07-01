"""
Filesystem path validators.
"""

from __future__ import annotations

from pathlib import PurePath

from django.core.exceptions import ValidationError

from .base import BaseValidator


class SafePathValidator(BaseValidator):
    """
    Prevent directory traversal.
    """

    message = "Unsafe path."

    def validate(self, value):
        path = PurePath(str(value))

        if ".." in path.parts:
            raise ValidationError(self.message)

        if path.is_absolute():
            raise ValidationError(self.message)
