"""
Organization Setting service.
"""
from __future__ import annotations

import json
from typing import Any

from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.utils import timezone

from apps.organization.models.organization import Organization
from apps.settings.models.definition import SettingDefinition
from apps.settings.models.organization import OrganizationSetting
from apps.settings.validators.organization import OrganizationSettingValidator

from .base import SettingsBaseService


class OrganizationSettingService(SettingsBaseService):
    """
    Service for OrganizationSetting.
    """
    
    model = OrganizationSetting
    validator = OrganizationSettingValidator
    
    @classmethod
    @transaction.atomic
    def create_setting(cls, organization: Organization, setting_code: str, value: Any) -> OrganizationSetting:
        """
        Create a new organization setting.
        """
        setting_def = SettingDefinition.objects.get(code=setting_code)
        
        instance = cls.model.objects.create(
            organization=organization,
            setting=setting_def,
            value=json.dumps(value),
        )
        return instance
    
    @classmethod
    @transaction.atomic
    def update_setting(cls, instance: OrganizationSetting, value: Any) -> OrganizationSetting:
        """
        Update an organization setting value.
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
    def delete_setting(cls, instance: OrganizationSetting) -> None:
        """
        Delete an organization setting.
        """
        if instance.is_locked:
            raise PermissionDenied(
                f"Setting '{instance.setting.code}' is locked."
            )

        instance.delete()
    
    @classmethod
    @transaction.atomic
    def lock_setting(cls, instance: OrganizationSetting, user) -> OrganizationSetting:
        """
        Lock an organization setting.
        """
        instance.is_locked = True
        instance.locked_by = user
        instance.locked_at = timezone.now()
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def unlock_setting(cls, instance: OrganizationSetting) -> OrganizationSetting:
        """
        Unlock an organization setting.
        """
        instance.is_locked = False
        instance.locked_by = None
        instance.locked_at = None
        instance.save()
        return instance
