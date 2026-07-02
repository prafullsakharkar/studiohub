"""
Internationalization validators.

Reusable validators for countries, currencies, languages
and timezones.
"""

from __future__ import annotations

from zoneinfo import available_timezones

import pycountry
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

_VALID_TIMEZONES = frozenset(available_timezones())

_VALID_COUNTRIES = frozenset(
    country.alpha_2.upper()
    for country in pycountry.countries
    if hasattr(country, "alpha_2")
)

_VALID_CURRENCIES = frozenset(
    currency.alpha_3.upper()
    for currency in pycountry.currencies
    if hasattr(currency, "alpha_3")
)

_VALID_LANGUAGES = frozenset(
    language.alpha_2.lower()
    for language in pycountry.languages
    if hasattr(language, "alpha_2")
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


def validate_language(value: str) -> str:
    """
    Validate ISO-639-1 language code.
    """

    if not value:
        return value

    value = value.lower()

    if value not in _VALID_LANGUAGES:
        raise ValidationError(
            _("'%(value)s' is not a valid language code."),
            params={"value": value},
        )

    return value


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
