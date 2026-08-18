"""
Change Log service.
"""
from __future__ import annotations

from typing import Any

from django.db import transaction

from apps.audit.models.change_log import ChangeLog
from apps.audit.validators.change_log import ChangeLogValidator

from .base import AuditBaseService


class ChangeLogService(AuditBaseService):
    """
    Service for ChangeLog.
    """
    
    model = ChangeLog
    validator = ChangeLogValidator
    
    @classmethod
    @transaction.atomic
    def create_change(cls, **validated_data) -> ChangeLog:
        """
        Create a new change log.
        """
        instance = cls.model.objects.create(**validated_data)
        return instance
    
    @classmethod
    @transaction.atomic
    def update_change(cls, instance: ChangeLog, **validated_data) -> ChangeLog:
        """
        Update a change log.
        """
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def delete_change(cls, instance: ChangeLog) -> None:
        """
        Delete a change log.
        """
        instance.delete()
