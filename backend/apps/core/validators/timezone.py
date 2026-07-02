"""
Internationalization validators.

Reusable validators for timezones.
"""

from __future__ import annotations

from zoneinfo import available_timezones

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

_VALID_TIMEZONES = frozenset(available_timezones())


def validate_timezone(value: str) -> str:
    """
    Validate IANA timezone.
    """

    if not value:
        return value

    if value not in _VALID_TIMEZONES:
        raise ValidationError(
            _("'%(value)s' is not a valid timezone."),
            params={"value": value},
        )

    return value
