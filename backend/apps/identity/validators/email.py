"""
Identity email validator.
"""

from __future__ import annotations

from django.core.validators import validate_email


def validate_email(value: str) -> None:
    """Validate email address."""
    from django.core.validators import validate_email as django_validate_email

    django_validate_email(value)
