"""
Theme service.
"""
from __future__ import annotations

from django.db import transaction

from apps.settings.models.theme import Theme
from apps.settings.validators.theme import ThemeValidator

from .base import SettingsBaseService


class ThemeService(SettingsBaseService):
    """
    Service for Theme.
    """
    
    model = Theme
    validator = ThemeValidator
    
    @classmethod
    @transaction.atomic
    def create_theme(cls, **validated_data) -> Theme:
        """
        Create a new theme.
        """
        instance = cls.model.objects.create(**validated_data)
        return instance
    
    @classmethod
    @transaction.atomic
    def update_theme(cls, instance: Theme, **validated_data) -> Theme:
        """
        Update a theme.
        """
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def delete_theme(cls, instance: Theme) -> None:
        """
        Delete a theme.
        """
        instance.delete()
    
    @classmethod
    @transaction.atomic
    def activate_theme(cls, instance: Theme) -> Theme:
        """
        Activate a theme.
        """
        instance.is_active = True
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def deactivate_theme(cls, instance: Theme) -> Theme:
        """
        Deactivate a theme.
        """
        instance.is_active = False
        instance.save()
        return instance
