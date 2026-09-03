"""
Track service.
"""
from __future__ import annotations

from django.db import transaction

from apps.audit.models.track import Track
from apps.audit.validators.track import TrackValidator

from .base import AuditBaseService


class TrackService(AuditBaseService):
    """
    Service for Track.
    """
    
    model = Track
    validator = TrackValidator
    
    @classmethod
    @transaction.atomic
    def create_track(cls, **validated_data) -> Track:
        """
        Create a new track.
        """
        instance = cls.model.objects.create(**validated_data)
        return instance
    
    @classmethod
    @transaction.atomic
    def update_track(cls, instance: Track, **validated_data) -> Track:
        """
        Update a track.
        """
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
    
    @classmethod
    @transaction.atomic
    def delete_track(cls, instance: Track) -> None:
        """
        Delete a track.
        """
        instance.delete()
