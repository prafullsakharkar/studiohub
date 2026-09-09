"""
Setting Category service.
"""
from __future__ import annotations

from django.db import transaction

from apps.settings.models.category import SettingCategory
from apps.settings.validators.category import SettingCategoryValidator

from .base import SettingsBaseService


class SettingCategoryService(SettingsBaseService):
    """
    Service for SettingCategory.
    """
    
    model = SettingCategory
    validator = SettingCategoryValidator
    
    @classmethod
    @transaction.atomic
    def create_category(cls, **validated_data) -> SettingCategory:
        """
        Create a new setting category.
        """
        instance = cls.model.objects.create(**validated_data)
        return instance
    
    @classmethod
    @transaction.atomic
    def update_category(cls, instance: SettingCategory, **validated_data) -> SettingCategory:
        """
        Update a setting category.
        """
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def delete_category(cls, instance: SettingCategory) -> None:
        """
        Delete a setting category.
        """
        instance.delete()
    
    @classmethod
    @transaction.atomic
    def archive_category(cls, instance: SettingCategory) -> SettingCategory:
        """
        Archive a setting category.
        """
        instance.is_active = False
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def restore_category(cls, instance: SettingCategory) -> SettingCategory:
        """
        Restore a setting category.
        """
        instance.is_active = True
        instance.save()
        return instance
