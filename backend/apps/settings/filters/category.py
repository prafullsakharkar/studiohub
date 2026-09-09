"""
Setting Category filter.
"""
from __future__ import annotations

from apps.settings.filters.base import SettingsBaseFilter
from apps.settings.models.category import SettingCategory


class SettingCategoryFilter(SettingsBaseFilter):
    """
    Filter for SettingCategory.
    """

    class Meta:
        model = SettingCategory
        fields = {
            "code": ["exact", "icontains"],
            "name": ["exact", "icontains"],
            "is_active": ["exact"],
            "order": ["exact", "gte", "lte"],
        }
