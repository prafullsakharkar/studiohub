"""
API Request selector.
"""
from __future__ import annotations

from django.db.models import QuerySet

from apps.audit.models.api_request import APIRequest

from .base import AuditBaseSelector


class APIRequestSelector(AuditBaseSelector):
    """
    Read operations for APIRequest.
    """
    
    model = APIRequest
    
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
    def get_by_id(cls, api_request_id: str):
        """
        Get an API request by its ID.
        """
        return cls.get_queryset().get(id=api_request_id)
    
    @classmethod
    def by_user(cls, user_id: str):
        """
        Get API requests by user.
        """
        return cls.get_queryset().filter(user_id=user_id)
    
    @classmethod
    def by_organization(cls, organization_id: str):
        """
        Get API requests for an organization.
        """
        return cls.get_queryset().filter(organization_id=organization_id)
    
    @classmethod
    def by_method(cls, method: str):
        """
        Get API requests by method.
        """
        return cls.get_queryset().filter(method=method)
