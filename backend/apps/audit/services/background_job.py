"""
Background Job service.
"""
from __future__ import annotations

from typing import Any

from django.db import transaction

from apps.audit.models.background_job import BackgroundJob
from apps.audit.validators.background_job import BackgroundJobValidator

from .base import AuditBaseService


class BackgroundJobService(AuditBaseService):
    """
    Service for BackgroundJob.
    """
    
    model = BackgroundJob
    validator = BackgroundJobValidator
    
    @classmethod
    @transaction.atomic
    def create_job(cls, **validated_data) -> BackgroundJob:
        """
        Create a new background job log.
        """
        instance = cls.model.objects.create(**validated_data)
        return instance
    
    @classmethod
    @transaction.atomic
    def update_job(cls, instance: BackgroundJob, **validated_data) -> BackgroundJob:
        """
        Update a background job log.
        """
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def delete_job(cls, instance: BackgroundJob) -> None:
        """
        Delete a background job log.
        """
        instance.delete()
