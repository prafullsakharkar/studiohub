"""
Setting Definition selector.
"""
from __future__ import annotations

from django.db.models import QuerySet

from apps.settings.models.definition import SettingDefinition

from .base import SettingsBaseSelector


class SettingDefinitionSelector(SettingsBaseSelector):
    """
    Read operations for SettingDefinition.
    """
    
    model = SettingDefinition
    
    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return cls.model.objects.all()
    
    @classmethod
    def get_by_code(cls, code: str):
        """
        Get a setting definition by its code.
        """
        return cls.get_queryset().get(code=code)
    
    @classmethod
    def by_category(cls, category_code: str):
        """
        Get settings by category.
        """
        return cls.get_queryset().filter(category__code=category_code)
    
    @classmethod
    def by_scope(cls, scope: str):
        """
        Get settings by scope.
        """
        return cls.get_queryset().filter(scope=scope)
    
    @classmethod
    def active(cls):
        """
        Get active settings.
        """
        return cls.get_queryset().filter(is_active=True)
    
    @classmethod
    def inactive(cls):
        """
        Get inactive settings.
        """
        return cls.get_queryset().filter(is_active=False)
