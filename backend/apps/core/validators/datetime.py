"""
Datetime validators.
"""

from typing import Any

from django.core.exceptions import ValidationError

from .base import BaseValidator


class DateRangeValidator(BaseValidator):

    def __call__(
        self,
        start: Any,
        end: Any | None = None,
        **kwargs: Any,
    ):

        if end is None:
            raise ValidationError("End date must be provided.")

        if start > end:
            raise ValidationError("Start date must be before end date.")
