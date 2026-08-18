"""
Change Log selector.
"""
from __future__ import annotations

from django.db.models import QuerySet

from apps.audit.models.change_log import ChangeLog

from .base import AuditBaseSelector


class ChangeLogSelector(AuditBaseSelector):
    """
    Read operations for ChangeLog.
    """
    
    model = ChangeLog
    
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
    def get_by_id(cls, change_log_id: str):
        """
        Get a change log by its ID.
        """
        return cls.get_queryset().get(id=change_log_id)
    
    @classmethod
    def by_user(cls, user_id: str):
        """
        Get change logs by user.
        """
        return cls.get_queryset().filter(user_id=user_id)
    
    @classmethod
    def by_organization(cls, organization_id: str):
        """
        Get change logs for an organization.
        """
        return cls.get_queryset().filter(organization_id=organization_id)
    
    @classmethod
    def by_target(cls, target_type: str, target_id: str):
        """
        Get change logs for a specific target.
        """
        return cls.get_queryset().filter(
            target_type=target_type,
            target_id=target_id,
        )
