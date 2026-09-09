"""
Activity service.
"""
from __future__ import annotations

from django.db import transaction

from apps.audit.models.activity import Activity
from apps.audit.validators.activity import ActivityValidator

from .base import AuditBaseService


class ActivityService(AuditBaseService):
    """
    Service for Activity.
    """
    
    model = Activity
    validator = ActivityValidator
    
    @classmethod
    @transaction.atomic
    def create_activity(cls, **validated_data) -> Activity:
        """
        Create a new activity.
        """
        instance = cls.model.objects.create(**validated_data)
        return instance
    
    @classmethod
    @transaction.atomic
    def update_activity(cls, instance: Activity, **validated_data) -> Activity:
        """
        Update an activity.
        """
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def delete_activity(cls, instance: Activity) -> None:
        """
        Delete an activity.
        """
        instance.delete()
