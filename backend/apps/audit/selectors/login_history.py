"""
Login History selector.
"""
from __future__ import annotations

from django.db.models import QuerySet

from apps.audit.models.login_history import LoginHistory

from .base import AuditBaseSelector


class LoginHistorySelector(AuditBaseSelector):
    """
    Read operations for LoginHistory.
    """
    
    model = LoginHistory
    
    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return cls._scope_by_user_or_organization(
            cls.model.objects.all(),
            request=request,
        )
    
    @classmethod
    def get_by_id(cls, login_history_id: str):
        """
        Get a login history by its ID.
        """
        return cls.get_queryset().get(id=login_history_id)
    
    @classmethod
    def by_user(cls, user_id: str):
        """
        Get login history by user.
        """
        return cls.get_queryset().filter(user_id=user_id)
    
    @classmethod
    def by_organization(cls, organization_id: str):
        """
        Get login history for an organization.
        """
        return cls.get_queryset().filter(organization_id=organization_id)
    
    @classmethod
    def by_type(cls, login_type: str):
        """
        Get login history by type.
        """
        return cls.get_queryset().filter(login_type=login_type)
