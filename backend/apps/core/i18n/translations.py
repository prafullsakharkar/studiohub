# i18n/translations.py
"""
Translation utilities.
"""

from __future__ import annotations

from django.utils.translation import gettext as django_gettext
from django.utils.translation import gettext_lazy as django_gettext_lazy

gettext = django_gettext
gettext_lazy = django_gettext_lazy

__all__ = [
    "gettext",
    "gettext_lazy",
]
