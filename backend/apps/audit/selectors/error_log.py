"""
Error Log selector.
"""
from __future__ import annotations

from django.db.models import QuerySet

from apps.audit.models.error_log import ErrorLog

from .base import AuditBaseSelector


class ErrorLogSelector(AuditBaseSelector):
    """
    Read operations for ErrorLog.
    """
    
    model = ErrorLog
    
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
    def get_by_id(cls, error_log_id: str):
        """
        Get an error log by its ID.
        """
        return cls.get_queryset().get(id=error_log_id)
    
    @classmethod
    def by_user(cls, user_id: str):
        """
        Get error logs by user.
        """
        return cls.get_queryset().filter(user_id=user_id)
    
    @classmethod
    def by_organization(cls, organization_id: str):
        """
        Get error logs for an organization.
        """
        return cls.get_queryset().filter(organization_id=organization_id)
    
    @classmethod
    def by_severity(cls, severity: str):
        """
        Get error logs by severity.
        """
        return cls.get_queryset().filter(severity=severity)
    
    @classmethod
    def unresolved(cls):
        """
        Get unresolved error logs.
        """
        return cls.get_queryset().filter(resolved=False)
