"""
System Setting service.
"""
from __future__ import annotations

import json
from typing import Any

from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.utils import timezone

from apps.settings.models.definition import SettingDefinition
from apps.settings.models.system import SystemSetting
from apps.settings.validators.system import SystemSettingValidator

from .base import SettingsBaseService


class SystemSettingService(SettingsBaseService):
    """
    Service for SystemSetting.
    """
    
    model = SystemSetting
    validator = SystemSettingValidator
    
    @classmethod
    @transaction.atomic
    def create_setting(cls, setting_code: str, value: Any) -> SystemSetting:
        """
        Create a new system setting.
        """
        setting_def = SettingDefinition.objects.get(code=setting_code)
        
        instance = cls.model.objects.create(
            setting=setting_def,
            value=json.dumps(value),
        )
        return instance
    
    @classmethod
    @transaction.atomic
    def update_setting(cls, instance: SystemSetting, value: Any) -> SystemSetting:
        """
        Update a system setting value.
        """
        if instance.is_locked:
            raise PermissionDenied(
                f"Setting '{instance.setting.code}' is locked."
            )

        instance.value = json.dumps(value)
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def delete_setting(cls, instance: SystemSetting) -> None:
        """
        Delete a system setting.
        """
        if instance.is_locked:
            raise PermissionDenied(
                f"Setting '{instance.setting.code}' is locked."
            )

        instance.delete()
    
    @classmethod
    @transaction.atomic
    def lock_setting(cls, instance: SystemSetting, user) -> SystemSetting:
        """
        Lock a system setting.
        """
        instance.is_locked = True
        instance.locked_by = user
        instance.locked_at = timezone.now()
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def unlock_setting(cls, instance: SystemSetting) -> SystemSetting:
        """
        Unlock a system setting.
        """
        instance.is_locked = False
        instance.locked_by = None
        instance.locked_at = None
        instance.save()
        return instance
