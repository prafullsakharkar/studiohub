"""
Catalog field validators (DOM-MD-COM-04/05, DOM-MD-CAT, DOM-MD-STS).

Pure functions: they normalize and check values and raise Django's
``ValidationError`` keyed by field, which the core exception handler turns
into a 400. Database lookups (duplicates) live in the service.
"""

from __future__ import annotations

import re
from typing import Any

from django.core.exceptions import ValidationError

from apps.masterdata.models import MasterDataScope, StatusCategory, StatusEntityType

CODE_MAX_LENGTH = 100
NAME_MAX_LENGTH = 255
# Hex (#RGB .. #RRGGBBAA) or a plain color keyword; rejects markup and spaces.
_COLOR_RE = re.compile(r"^(#[0-9a-fA-F]{3,8}|[A-Za-z][A-Za-z0-9-]{0,30})$")


def _fail(field: str, message: str) -> ValidationError:
    return ValidationError({field: [message]})


def clean_text(value: Any, field: str, *, required: bool, max_length: int) -> str:
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise _fail(field, "Not a valid string.")
    value = value.strip()
    if required and not value:
        raise _fail(field, "This field may not be blank.")
    if len(value) > max_length:
        raise _fail(field, f"Ensure this field has no more than {max_length} characters.")
    if any(ord(ch) < 32 for ch in value):
        raise _fail(field, "Control characters are not allowed.")
    return value


def clean_scope(value: Any) -> str:
    if value in (None, ""):
        return MasterDataScope.GLOBAL
    if value != MasterDataScope.GLOBAL:
        raise _fail("scope", "Only the GLOBAL scope is supported.")
    return MasterDataScope.GLOBAL


def clean_metadata(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise _fail("metadata", "Metadata must be a JSON object.")
    return value


def clean_color(value: Any) -> str:
    value = clean_text(value, "color", required=False, max_length=20)
    if value and not _COLOR_RE.match(value):
        raise _fail("color", "Enter a hex color (#RRGGBB) or a color keyword.")
    return value


def clean_entity_type(value: Any) -> str:
    if value not in StatusEntityType.values:
        raise _fail("entity_type", f"Must be one of: {', '.join(StatusEntityType.values)}.")
    return value


def clean_category(value: Any) -> str:
    if value in (None, ""):
        return ""
    if value not in StatusCategory.values:
        raise _fail("category", f"Must be one of: {', '.join(StatusCategory.values)}.")
    return value


def clean_non_negative_int(value: Any, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise _fail(field, "Must be a non-negative integer.")
    return value
