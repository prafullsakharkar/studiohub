"""
Localization selector.
"""
from __future__ import annotations

from django.db.models import QuerySet

from apps.organization.models.organization import Organization
from apps.settings.models.localization import Localization

from .base import SettingsBaseSelector


class LocalizationSelector(SettingsBaseSelector):
    """
    Read operations for Localization.
    """
    
    model = Localization
    
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
        Get a localization by its code.
        """
        return cls.get_queryset().get(code=code)
    
    @classmethod
    def for_organization(cls, organization: Organization):
        """
        Get localizations for a specific organization.
        """
        return cls.get_queryset().filter(organization=organization)
    
    @classmethod
    def active(cls):
        """
        Get active localizations.
        """
        return cls.get_queryset().filter(is_active=True)
    
    @classmethod
    def get_default(cls):
        """
        Get the default localization (no organization).
        """
        return cls.get_queryset().filter(organization__isnull=True).first()
