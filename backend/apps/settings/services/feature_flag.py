"""
Feature Flag service.
"""
from __future__ import annotations

from django.db import transaction

from apps.settings.models.feature_flag import FeatureFlag
from apps.settings.validators.feature_flag import FeatureFlagValidator

from .base import SettingsBaseService


class FeatureFlagService(SettingsBaseService):
    """
    Service for FeatureFlag.
    """
    
    model = FeatureFlag
    validator = FeatureFlagValidator
    
    @classmethod
    @transaction.atomic
    def create_flag(cls, **validated_data) -> FeatureFlag:
        """
        Create a new feature flag.
        """
        instance = cls.model.objects.create(**validated_data)
        return instance
    
    @classmethod
    @transaction.atomic
    def update_flag(cls, instance: FeatureFlag, **validated_data) -> FeatureFlag:
        """
        Update a feature flag.
        """
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def delete_flag(cls, instance: FeatureFlag) -> None:
        """
        Delete a feature flag.
        """
        instance.delete()
    
    @classmethod
    @transaction.atomic
    def enable_flag(cls, instance: FeatureFlag) -> FeatureFlag:
        """
        Enable a feature flag.
        """
        instance.status = FeatureFlag.STATUS_ENABLED
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def disable_flag(cls, instance: FeatureFlag) -> FeatureFlag:
        """
        Disable a feature flag.
        """
        instance.status = FeatureFlag.STATUS_DISABLED
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def schedule_flag(cls, instance: FeatureFlag, start_date, end_date) -> FeatureFlag:
        """
        Schedule a feature flag.
        """
        instance.status = FeatureFlag.STATUS_SCHEDULED
        instance.start_date = start_date
        instance.end_date = end_date
        instance.save()
        return instance
