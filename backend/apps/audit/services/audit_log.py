"""
Audit Log service.
"""
from __future__ import annotations

from typing import Any

from django.db import transaction

from apps.audit.models.audit_log import AuditLog
from apps.audit.validators.audit_log import AuditLogValidator

from .base import AuditBaseService


class AuditLogService(AuditBaseService):
    """
    Service for AuditLog.
    """
    
    model = AuditLog
    validator = AuditLogValidator
    
    @classmethod
    @transaction.atomic
    def create_log(cls, **validated_data) -> AuditLog:
        """
        Create a new audit log.
        """
        instance = cls.model.objects.create(**validated_data)
        return instance
    
    @classmethod
    @transaction.atomic
    def update_log(cls, instance: AuditLog, **validated_data) -> AuditLog:
        """
        Update an audit log.
        """
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def delete_log(cls, instance: AuditLog) -> None:
        """
        Delete an audit log.
        """
        instance.delete()
