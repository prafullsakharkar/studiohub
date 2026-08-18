"""
Track selector.
"""
from __future__ import annotations

from django.db.models import QuerySet

from apps.audit.models.track import Track

from .base import AuditBaseSelector


class TrackSelector(AuditBaseSelector):
    """
    Read operations for Track.
    """
    
    model = Track
    
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
    def get_by_id(cls, track_id: str):
        """
        Get a track by its ID.
        """
        return cls.get_queryset().get(id=track_id)
    
    @classmethod
    def by_user(cls, user_id: str):
        """
        Get tracks by user.
        """
        return cls.get_queryset().filter(user_id=user_id)
    
    @classmethod
    def by_organization(cls, organization_id: str):
        """
        Get tracks for an organization.
        """
        return cls.get_queryset().filter(organization_id=organization_id)
    
    @classmethod
    def by_event_type(cls, event_type: str):
        """
        Get tracks by event type.
        """
        return cls.get_queryset().filter(event_type=event_type)
