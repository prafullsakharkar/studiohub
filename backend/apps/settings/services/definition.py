"""
Setting Definition service.
"""
from __future__ import annotations

from django.db import transaction

from apps.settings.models.definition import SettingDefinition
from apps.settings.validators.definition import SettingDefinitionValidator

from .base import SettingsBaseService


class SettingDefinitionService(SettingsBaseService):
    """
    Service for SettingDefinition.
    """
    
    model = SettingDefinition
    validator = SettingDefinitionValidator
    
    @classmethod
    @transaction.atomic
    def create_definition(cls, **validated_data) -> SettingDefinition:
        """
        Create a new setting definition.
        """
        instance = cls.model.objects.create(**validated_data)
        return instance
    
    @classmethod
    @transaction.atomic
    def update_definition(cls, instance: SettingDefinition, **validated_data) -> SettingDefinition:
        """
        Update a setting definition.
        """
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def delete_definition(cls, instance: SettingDefinition) -> None:
        """
        Delete a setting definition.
        """
        instance.delete()
    
    @classmethod
    @transaction.atomic
    def archive_definition(cls, instance: SettingDefinition) -> SettingDefinition:
        """
        Archive a setting definition.
        """
        instance.is_active = False
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def restore_definition(cls, instance: SettingDefinition) -> SettingDefinition:
        """
        Restore a setting definition.
        """
        instance.is_active = True
        instance.save()
        return instance
