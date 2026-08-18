"""
System Setting filter.
"""
from __future__ import annotations

from apps.settings.filters.base import SettingsBaseFilter
from apps.settings.models.system import SystemSetting


class SystemSettingFilter(SettingsBaseFilter):
    """
    Filter for SystemSetting.
    """

    class Meta:
        model = SystemSetting
        fields = {
            "setting": ["exact"],
            "is_locked": ["exact"],
        }
