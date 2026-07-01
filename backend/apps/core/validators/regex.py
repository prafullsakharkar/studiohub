"""
Reusable regex validator.
"""

from __future__ import annotations

import re

from django.core.exceptions import ValidationError

from .base import BaseValidator


class RegexValidator(BaseValidator):
    """
    Generic regex validator.
    """

    def __init__(
        self,
        pattern,
        message="Invalid format.",
        flags=0,
    ):
        self.pattern = re.compile(
            pattern,
            flags,
        )
        self.message = message

    def validate(self, value):
        if not self.pattern.fullmatch(str(value)):
            raise ValidationError(self.message)
