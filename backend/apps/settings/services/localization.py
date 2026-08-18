"""
Localization service.
"""
from __future__ import annotations

from typing import Any

from django.db import transaction

from apps.organization.models.organization import Organization
from apps.settings.models.localization import Localization
from apps.settings.validators.localization import LocalizationValidator

from .base import SettingsBaseService


class LocalizationService(SettingsBaseService):
    """
    Service for Localization.
    """
    
    model = Localization
    validator = LocalizationValidator
    
    @classmethod
    @transaction.atomic
    def create_localization(cls, **validated_data) -> Localization:
        """
        Create a new localization.
        """
        instance = cls.model.objects.create(**validated_data)
        return instance
    
    @classmethod
    @transaction.atomic
    def update_localization(cls, instance: Localization, **validated_data) -> Localization:
        """
        Update a localization.
        """
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def delete_localization(cls, instance: Localization) -> None:
        """
        Delete a localization.
        """
        instance.delete()
    
    @classmethod
    @transaction.atomic
    def activate_localization(cls, instance: Localization) -> Localization:
        """
        Activate a localization.
        """
        instance.is_active = True
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def deactivate_localization(cls, instance: Localization) -> Localization:
        """
        Deactivate a localization.
        """
        instance.is_active = False
        instance.save()
        return instance
