"""
Color validators.
"""

import re

from django.core.exceptions import ValidationError

from .base import BaseValidator

HEX_REGEX = re.compile(r"^#(?:[0-9A-Fa-f]{3}){1,2}$")


class HexColorValidator(BaseValidator):

    message = "Invalid hex color."

    def validate(self, value):

        if not HEX_REGEX.match(value):
            raise ValidationError(self.message)
