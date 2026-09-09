"""
Theme filter.
"""
from __future__ import annotations

from apps.settings.filters.base import SettingsBaseFilter
from apps.settings.models.theme import Theme


class ThemeFilter(SettingsBaseFilter):
    """
    Filter for Theme.
    """

    class Meta:
        model = Theme
        fields = {
            "code": ["exact", "icontains"],
            "name": ["exact", "icontains"],
            "theme_type": ["exact"],
            "is_active": ["exact"],
            "organization": ["exact"],
        }
