"""
Internationalization validators.

Reusable validators for languages.
"""

from __future__ import annotations

import pycountry
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

_VALID_LANGUAGES = frozenset(
    language.alpha_2.lower()
    for language in pycountry.languages
    if hasattr(language, "alpha_2")
)


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
