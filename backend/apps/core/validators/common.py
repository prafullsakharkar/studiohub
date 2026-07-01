"""
Common validation helpers.
"""

from __future__ import annotations

from django.core.exceptions import ValidationError


def ensure(condition: bool, message: str):
    """
    Raise ValidationError if condition is False.
    """
    if not condition:
        raise ValidationError(message)


def ensure_not_empty(value, message="Value cannot be empty."):
    ensure(bool(value), message)


def ensure_positive(value, message="Value must be positive."):
    ensure(value > 0, message)


def ensure_non_negative(value, message="Value must be non-negative."):
    ensure(value >= 0, message)
