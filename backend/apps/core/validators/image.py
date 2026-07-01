"""
Image validators.
"""

from __future__ import annotations

from pathlib import Path

from django.core.exceptions import ValidationError

from .base import BaseValidator


class ImageExtensionValidator(BaseValidator):
    """
    Validate supported image extensions.
    """

    message = "Unsupported image format."

    allowed_extensions = {
        ".jpg",
        ".jpeg",
        ".png",
        ".tif",
        ".tiff",
        ".exr",
        ".webp",
    }

    def validate(self, value):
        suffix = Path(value.name).suffix.lower()

        if suffix not in self.allowed_extensions:
            raise ValidationError(self.message)
