"""
Setting Category selector.
"""
from __future__ import annotations

from django.db.models import QuerySet

from apps.settings.models.category import SettingCategory

from .base import SettingsBaseSelector


class SettingCategorySelector(SettingsBaseSelector):
    """
    Read operations for SettingCategory.
    """
    
    model = SettingCategory
    
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
        Get a category by its code.
        """
        return cls.get_queryset().get(code=code)
    
    @classmethod
    def active(cls):
        """
        Get active categories.
        """
        return cls.get_queryset().filter(is_active=True)
    
    @classmethod
    def inactive(cls):
        """
        Get inactive categories.
        """
        return cls.get_queryset().filter(is_active=False)
