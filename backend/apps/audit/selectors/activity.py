"""
Activity selector.
"""
from __future__ import annotations

from django.db.models import QuerySet

from apps.audit.models.activity import Activity

from .base import AuditBaseSelector


class ActivitySelector(AuditBaseSelector):
    """
    Read operations for Activity.
    """
    
    model = Activity
    
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
    def get_by_id(cls, activity_id: str):
        """
        Get an activity by its ID.
        """
        return cls.get_queryset().get(id=activity_id)
    
    @classmethod
    def by_user(cls, user_id: str):
        """
        Get activities by user.
        """
        return cls.get_queryset().filter(user_id=user_id)
    
    @classmethod
    def by_organization(cls, organization_id: str):
        """
        Get activities for an organization.
        """
        return cls.get_queryset().filter(organization_id=organization_id)
    
    @classmethod
    def by_type(cls, activity_type: str):
        """
        Get activities by type.
        """
        return cls.get_queryset().filter(activity_type=activity_type)
