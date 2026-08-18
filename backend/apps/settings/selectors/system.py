"""
System Setting selector.
"""
from __future__ import annotations

from django.db.models import QuerySet

from apps.settings.models.system import SystemSetting

from .base import SettingsBaseSelector


class SystemSettingSelector(SettingsBaseSelector):
    """
    Read operations for SystemSetting.
    """
    
    model = SystemSetting
    
    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return cls.model.objects.all()
    
    @classmethod
    def get_by_setting(cls, setting_code: str):
        """
        Get a system setting by its setting code.
        """
        return cls.get_queryset().get(setting__code=setting_code)
    
    @classmethod
    def active(cls):
        """
        Get active settings.
        """
        return cls.get_queryset().filter(setting__is_active=True)
