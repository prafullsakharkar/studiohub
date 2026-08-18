"""
Login History service.
"""
from __future__ import annotations

from typing import Any

from django.db import transaction

from apps.audit.models.login_history import LoginHistory
from apps.audit.validators.login_history import LoginHistoryValidator

from .base import AuditBaseService


class LoginHistoryService(AuditBaseService):
    """
    Service for LoginHistory.
    """
    
    model = LoginHistory
    validator = LoginHistoryValidator
    
    @classmethod
    @transaction.atomic
    def create_login(cls, **validated_data) -> LoginHistory:
        """
        Create a new login history entry.
        """
        instance = cls.model.objects.create(**validated_data)
        return instance
    
    @classmethod
    @transaction.atomic
    def update_login(cls, instance: LoginHistory, **validated_data) -> LoginHistory:
        """
        Update a login history entry.
        """
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def delete_login(cls, instance: LoginHistory) -> None:
        """
        Delete a login history entry.
        """
        instance.delete()
