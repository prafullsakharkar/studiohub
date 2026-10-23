"""
Field validators for the directory services (clients, vendors, contacts, contracts).

Pure functions: they normalize and check one value and raise Django's
``ValidationError`` keyed by field, which the core handler turns into a 400.
"""

from __future__ import annotations

import datetime
import re
from collections.abc import Iterable
from decimal import Decimal, InvalidOperation
from typing import Any
from zoneinfo import available_timezones

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator, validate_email

from apps.masterdata.validators.catalog import clean_text

_URL = URLValidator(schemes=["http", "https"])
_PHONE_RE = re.compile(r"^[+0-9 ().-]{3,50}$")
_CURRENCY_RE = re.compile(r"^[A-Z]{3}$")

#: ISO 4217 codes accepted on contracts. Extend here when a studio bills in another one.
CURRENCIES = frozenset(
    [
        "USD",
        "EUR",
        "GBP",
        "CAD",
        "AUD",
        "NZD",
        "JPY",
        "CNY",
        "HKD",
        "SGD",
        "KRW",
        "INR",
        "CHF",
        "SEK",
        "NOK",
        "DKK",
        "MXN",
        "BRL",
        "ZAR",
        "AED",
    ]
)
MAX_AMOUNT = 2**63 - 1


def _fail(field: str, message: str) -> ValidationError:
    return ValidationError({field: [message]})


def clean_email(value: Any, field: str = "email") -> str:
    """Trimmed, lower-cased, syntactically valid; blank is allowed."""
    value = clean_text(value, field, required=False, max_length=254).lower()
    if value:
        try:
            validate_email(value)
        except ValidationError:
            raise _fail(field, "Enter a valid e-mail address.") from None
    return value


def clean_phone(value: Any, field: str = "phone", max_length: int = 50) -> str:
    """Digits, ``+``, spaces, ``(``, ``)``, ``-`` and ``.`` only; runs of spaces collapse."""
    value = " ".join(clean_text(value, field, required=False, max_length=max_length).split())
    if value and not _PHONE_RE.match(value):
        raise _fail(field, f"Use digits, spaces and + ( ) - . only (3 to {max_length} characters).")
    return value


def clean_timezone(value: Any, field: str = "timezone", *, required: bool = False) -> str:
    """An IANA zone name (``Asia/Kolkata``); blank only when not required."""
    value = clean_text(value, field, required=required, max_length=50)
    if value and value not in available_timezones():
        raise _fail(field, "Enter an IANA time zone name such as Europe/London.")
    return value


def clean_choice(value: Any, field: str, choices: Iterable[str]) -> str:
    allowed = tuple(choices)
    if value not in allowed:
        raise _fail(field, f"Choose one of: {', '.join(allowed)}.")
    return value


def clean_str_list(
    value: Any, field: str, *, max_items: int = 100, max_length: int = 100
) -> list[str]:
    """A list of short non-blank strings, trimmed; duplicates removed, order kept."""
    if not isinstance(value, list):
        raise _fail(field, "Expected a list of strings.")
    if len(value) > max_items:
        raise _fail(field, f"No more than {max_items} items.")
    out: list[str] = []
    for item in value:
        text = clean_text(item, field, required=True, max_length=max_length)
        if text not in out:
            out.append(text)
    return out


def clean_url(value: Any, field: str, max_length: int = 500) -> str:
    value = clean_text(value, field, required=False, max_length=max_length)
    if value:
        try:
            _URL(value)
        except ValidationError:
            raise _fail(field, "Enter a valid http(s) URL.") from None
    return value


def clean_bool(value: Any, field: str) -> bool:
    if not isinstance(value, bool):
        raise _fail(field, "Must be true or false.")
    return value


def clean_decimal(
    value: Any,
    field: str,
    *,
    minimum: Decimal,
    maximum: Decimal,
    places: int,
    nullable: bool = False,
) -> Decimal | None:
    if value is None or value == "":
        if nullable:
            return None
        raise _fail(field, "This field may not be null.")
    if isinstance(value, bool):
        raise _fail(field, "A valid number is required.")
    try:
        number = Decimal(str(value))
    except InvalidOperation:
        raise _fail(field, "A valid number is required.") from None
    if not number.is_finite() or not (minimum <= number <= maximum):
        raise _fail(field, f"Must be between {minimum} and {maximum}.")
    if -number.as_tuple().exponent > places:  # pyright: ignore[reportOperatorIssue]
        raise _fail(field, f"No more than {places} decimal places.")
    return number


def clean_amount(value: Any, field: str) -> int:
    """A whole, non-negative amount in contract-currency units."""
    if isinstance(value, bool) or not isinstance(value, int) or not (0 <= value <= MAX_AMOUNT):
        raise _fail(field, "Must be a whole number, zero or more.")
    return value


def clean_currency(value: Any, field: str = "currency") -> str:
    value = clean_text(value, field, required=True, max_length=3).upper()
    if not _CURRENCY_RE.match(value) or value not in CURRENCIES:
        raise _fail(field, f"Must be one of: {', '.join(sorted(CURRENCIES))}.")
    return value


def clean_date(value: Any, field: str, *, nullable: bool = True) -> datetime.date | None:
    if value is None:
        if nullable:
            return None
        raise _fail(field, "This field may not be null.")
    if isinstance(value, datetime.datetime) or not isinstance(value, datetime.date):
        raise _fail(field, "Enter a valid date.")
    return value
