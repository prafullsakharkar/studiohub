"""
Datetime validators.
"""

from django.core.exceptions import ValidationError

from .base import BaseValidator


class DateRangeValidator(BaseValidator):

    def __call__(
        self,
        start,
        end,
    ):

        if start > end:
            raise ValidationError("Start date must be before end date.")
