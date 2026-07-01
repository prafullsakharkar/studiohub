"""
Frame validators.
"""

from django.core.exceptions import ValidationError


def validate_frame_range(
    start,
    end,
):

    if start < 0:
        raise ValidationError("Invalid start frame.")

    if end < start:
        raise ValidationError("Invalid end frame.")
