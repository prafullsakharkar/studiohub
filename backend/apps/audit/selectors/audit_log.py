"""
Audit Log selector.
"""
from __future__ import annotations

from django.db.models import QuerySet

from apps.audit.models.audit_log import AuditLog

from .base import AuditBaseSelector


class AuditLogSelector(AuditBaseSelector):
    """
    Read operations for AuditLog.
    """
    
    model = AuditLog
    
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
    def get_by_id(cls, audit_log_id: str):
        """
        Get an audit log by its ID.
        """
        return cls.get_queryset().get(id=audit_log_id)
    
    @classmethod
    def by_organization(cls, organization_id: str):
        """
        Get audit logs for an organization.
        """
        return cls.get_queryset().filter(organization_id=organization_id)
    
    @classmethod
    def by_actor(cls, user_id: str):
        """
        Get audit logs by actor.
        """
        return cls.get_queryset().filter(actor_id=user_id)
    
    @classmethod
    def by_date_range(cls, start_date, end_date):
        """
        Get audit logs within a date range.
        """
        return cls.get_queryset().filter(
            created_at__gte=start_date,
            created_at__lte=end_date,
        )
