"""
API Request service.
"""
from __future__ import annotations

from typing import Any

from django.db import transaction

from apps.audit.models.api_request import APIRequest
from apps.audit.validators.api_request import APIRequestValidator

from .base import AuditBaseService


class APIRequestService(AuditBaseService):
    """
    Service for APIRequest.
    """
    
    model = APIRequest
    validator = APIRequestValidator
    
    @classmethod
    @transaction.atomic
    def create_request(cls, **validated_data) -> APIRequest:
        """
        Create a new API request log.
        """
        instance = cls.model.objects.create(**validated_data)
        return instance
    
    @classmethod
    @transaction.atomic
    def update_request(cls, instance: APIRequest, **validated_data) -> APIRequest:
        """
        Update an API request log.
        """
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def delete_request(cls, instance: APIRequest) -> None:
        """
        Delete an API request log.
        """
        instance.delete()
