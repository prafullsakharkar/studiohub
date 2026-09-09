"""
Setting Definition filter.
"""
from __future__ import annotations

from apps.settings.filters.base import SettingsBaseFilter
from apps.settings.models.definition import SettingDefinition


class SettingDefinitionFilter(SettingsBaseFilter):
    """
    Filter for SettingDefinition.
    """

    class Meta:
        model = SettingDefinition
        fields = {
            "code": ["exact", "icontains"],
            "name": ["exact", "icontains"],
            "category": ["exact"],
            "data_type": ["exact"],
            "scope": ["exact"],
            "is_required": ["exact"],
            "is_active": ["exact"],
        }
