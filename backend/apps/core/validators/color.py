"""
Color validators.
"""

import re

from django.core.exceptions import ValidationError

from .base import BaseValidator

HEX_REGEX = re.compile(r"^#(?:[0-9A-Fa-f]{3}){1,2}$")


class HexColorValidator(BaseValidator):
    """
    Validator for hex color values.
    
    Supports both 3-digit and 6-digit hex color codes (e.g., #FFF, #FFFFFF).
    """

    def __init__(self, message=None, code=None):
        if message is not None:
            self.message = message
        if code is not None:
            self.code = code

    def __call__(self, value):
        self.validate(value)

    def validate(self, value):
        if not HEX_REGEX.match(value):
            raise ValidationError(self.message, code=self.code)

    def deconstruct(self):
        """
        Allow this validator to be serialized by Django migrations.
        
        Returns a tuple of (path, args, kwargs) where:
        - path: the import path to the validator class
        - args: positional arguments (empty for this validator)
        - kwargs: keyword arguments (message and code if they differ from defaults)
        """
        kwargs = {}
        if self.message != "Invalid hex color.":
            kwargs["message"] = self.message
        if self.code != "invalid":
            kwargs["code"] = self.code
        return (
            "apps.core.validators.color.HexColorValidator",
            [],
            kwargs
        )
