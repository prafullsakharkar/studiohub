"""
Localization filter.
"""
from __future__ import annotations

from apps.settings.filters.base import SettingsBaseFilter
from apps.settings.models.localization import Localization


class LocalizationFilter(SettingsBaseFilter):
    """
    Filter for Localization.
    """

    class Meta:
        model = Localization
        fields = {
            "code": ["exact", "icontains"],
            "name": ["exact", "icontains"],
            "language": ["exact"],
            "timezone": ["exact"],
            "is_active": ["exact"],
            "organization": ["exact"],
        }
