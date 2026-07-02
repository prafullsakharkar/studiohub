"""
Internationalization validators.

Reusable validators for currencies.
"""

from __future__ import annotations

import pycountry
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

_VALID_CURRENCIES = frozenset(
    currency.alpha_3.upper()
    for currency in pycountry.currencies
    if hasattr(currency, "alpha_3")
)


def validate_currency(value: str) -> str:
    """
    Validate ISO-4217 currency code.
    """

    if not value:
        return value

    value = value.upper()

    if value not in _VALID_CURRENCIES:
        raise ValidationError(
            _("'%(value)s' is not a valid currency code."),
            params={"value": value},
        )

    return value
