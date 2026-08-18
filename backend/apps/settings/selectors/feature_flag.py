"""
Feature Flag selector.
"""
from __future__ import annotations

from django.db import models
from django.db.models import QuerySet

from apps.organization.models.organization import Organization
from apps.settings.models.feature_flag import FeatureFlag

from .base import SettingsBaseSelector


class FeatureFlagSelector(SettingsBaseSelector):
    """
    Read operations for FeatureFlag.
    """
    
    model = FeatureFlag
    
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
        Get a feature flag by its code.
        """
        return cls.get_queryset().get(code=code)
    
    @classmethod
    def for_organization(cls, organization: Organization):
        """
        Get feature flags for a specific organization.
        """
        return cls.get_queryset().filter(organization=organization)
    
    @classmethod
    def active(cls):
        """
        Get active feature flags.
        """
        return cls.get_queryset().filter(status=FeatureFlag.STATUS_ENABLED)
    
    @classmethod
    def for_user(cls, organization: Organization, user_id: str):
        """
        Get feature flags enabled for a specific user.
        """
        queryset = cls.get_queryset()
        
        # System-wide flags (no organization)
        queryset = queryset.filter(
            models.Q(organization__isnull=True) |
            models.Q(organization=organization)
        )
        
        # Only enabled flags
        queryset = queryset.filter(status=FeatureFlag.STATUS_ENABLED)
        
        return queryset
