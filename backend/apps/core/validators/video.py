"""
Video validators.
"""

from __future__ import annotations

from pathlib import Path

from django.core.exceptions import ValidationError

from .base import BaseValidator


class VideoExtensionValidator(BaseValidator):
    """
    Validate supported video extensions.
    """

    message = "Unsupported video format."

    allowed_extensions = {
        ".mov",
        ".mp4",
        ".avi",
        ".mxf",
        ".mkv",
    }

    def validate(self, value):
        suffix = Path(value.name).suffix.lower()

        if suffix not in self.allowed_extensions:
            raise ValidationError(self.message)
