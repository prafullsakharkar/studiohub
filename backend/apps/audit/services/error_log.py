"""
Error Log service.
"""
from __future__ import annotations

from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.audit.models.error_log import ErrorLog
from apps.audit.validators.error_log import ErrorLogValidator

from .base import AuditBaseService


class ErrorLogService(AuditBaseService):
    """
    Service for ErrorLog.
    """
    
    model = ErrorLog
    validator = ErrorLogValidator
    
    @classmethod
    @transaction.atomic
    def create_error(cls, **validated_data) -> ErrorLog:
        """
        Create a new error log.
        """
        instance = cls.model.objects.create(**validated_data)
        return instance
    
    @classmethod
    @transaction.atomic
    def update_error(cls, instance: ErrorLog, **validated_data) -> ErrorLog:
        """
        Update an error log.
        """
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def delete_error(cls, instance: ErrorLog) -> None:
        """
        Delete an error log.
        """
        instance.delete()
    
    @classmethod
    @transaction.atomic
    def resolve_error(cls, instance: ErrorLog, user) -> ErrorLog:
        """
        Resolve an error log.
        """
        instance.resolved = True
        instance.resolved_at = timezone.now()
        instance.resolved_by = user
        instance.save()
        return instance
