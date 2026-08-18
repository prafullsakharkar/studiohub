"""
Organization Setting filter.
"""
from __future__ import annotations

from apps.settings.filters.base import SettingsBaseFilter
from apps.settings.models.organization import OrganizationSetting


class OrganizationSettingFilter(SettingsBaseFilter):
    """
    Filter for OrganizationSetting.
    """

    class Meta:
        model = OrganizationSetting
        fields = {
            "setting": ["exact"],
            "organization": ["exact"],
            "is_locked": ["exact"],
        }
