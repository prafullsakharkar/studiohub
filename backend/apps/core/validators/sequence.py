"""
Sequence validators.
"""

import re

from django.core.exceptions import ValidationError

SEQUENCE_REGEX = re.compile(r".+\.(\d+)\.[^.]+$")


def validate_sequence_filename(value):

    if not SEQUENCE_REGEX.match(value):
        raise ValidationError("Invalid sequence filename.")
