"""
Slug validators.
"""

import re

from django.core.exceptions import ValidationError

from .base import BaseValidator

SLUG_REGEX = re.compile(r"^[a-z0-9-]+$")


class SlugValidator(BaseValidator):

    message = "Invalid slug."

    def validate(self, value):

        if not SLUG_REGEX.match(value):
            raise ValidationError(self.message)
