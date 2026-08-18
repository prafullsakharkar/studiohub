"""
Track filter.
"""
from __future__ import annotations

from apps.audit.filters.base import AuditBaseFilter
from apps.audit.models.track import Track


class TrackFilter(AuditBaseFilter):
    """
    Filter for Track.
    """

    class Meta:
        model = Track
        fields = {
            "event_type": ["exact"],
            "user": ["exact"],
            "organization": ["exact"],
            "created_at": ["exact", "gte", "lte"],
        }
