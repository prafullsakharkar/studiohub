"""
Theme selector.
"""
from __future__ import annotations

from django.db.models import QuerySet

from apps.organization.models.organization import Organization
from apps.settings.models.theme import Theme

from .base import SettingsBaseSelector


class ThemeSelector(SettingsBaseSelector):
    """
    Read operations for Theme.
    """
    
    model = Theme
    
    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return cls._scope_by_request(
            cls.model.objects.all(),
            request=request,
        )
    
    @classmethod
    def get_by_code(cls, code: str):
        """
        Get a theme by its code.
        """
        return cls.get_queryset().get(code=code)
    
    @classmethod
    def for_organization(cls, organization: Organization):
        """
        Get themes for a specific organization.
        """
        return cls.get_queryset().filter(organization=organization)
    
    @classmethod
    def active(cls):
        """
        Get active themes.
        """
        return cls.get_queryset().filter(is_active=True)
    
    @classmethod
    def get_default(cls):
        """
        Get the default theme (no organization).
        """
        return cls.get_queryset().filter(organization__isnull=True).first()
