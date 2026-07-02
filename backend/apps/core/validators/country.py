"""
Internationalization validators.

Reusable validators for countries.
"""

from __future__ import annotations

import pycountry
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

_VALID_COUNTRIES = frozenset(
    country.alpha_2.upper()
    for country in pycountry.countries
    if hasattr(country, "alpha_2")
)


def validate_country(value: str) -> str:
    """
    Validate ISO-3166 Alpha-2 country code.
    """

    if not value:
        return value

    value = value.upper()

    if value not in _VALID_COUNTRIES:
        raise ValidationError(
            _("'%(value)s' is not a valid country code."),
            params={"value": value},
        )

    return value
