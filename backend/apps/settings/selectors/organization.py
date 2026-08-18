"""
Organization Setting selector.
"""
from __future__ import annotations

from django.db.models import QuerySet

from apps.organization.models.organization import Organization
from apps.settings.models.organization import OrganizationSetting

from .base import SettingsBaseSelector


class OrganizationSettingSelector(SettingsBaseSelector):
    """
    Read operations for OrganizationSetting.
    """
    
    model = OrganizationSetting
    
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
    def for_organization(cls, organization: Organization):
        """
        Get settings for a specific organization.
        """
        return cls.get_queryset().filter(organization=organization)
    
    @classmethod
    def get_by_setting_and_organization(cls, setting_code: str, organization: Organization):
        """
        Get a specific setting for an organization.
        """
        return cls.get_queryset().get(
            setting__code=setting_code,
            organization=organization,
        )
    
    @classmethod
    def active(cls):
        """
        Get active settings.
        """
        return cls.get_queryset().filter(
            setting__is_active=True,
            organization__status="active",
        )
