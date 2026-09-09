"""
Activity filter.
"""
from __future__ import annotations

from apps.audit.filters.base import AuditBaseFilter
from apps.audit.models.activity import Activity


class ActivityFilter(AuditBaseFilter):
    """
    Filter for Activity.
    """

    class Meta:
        model = Activity
        fields = {
            "activity_type": ["exact"],
            "status": ["exact"],
            "user": ["exact"],
            "organization": ["exact"],
            "created_at": ["exact", "gte", "lte"],
        }
