"""
Change Log filter.
"""
from __future__ import annotations

from apps.audit.filters.base import AuditBaseFilter
from apps.audit.models.change_log import ChangeLog


class ChangeLogFilter(AuditBaseFilter):
    """
    Filter for ChangeLog.
    """

    class Meta:
        model = ChangeLog
        fields = {
            "change_type": ["exact"],
            "target_type": ["exact"],
            "user": ["exact"],
            "organization": ["exact"],
            "created_at": ["exact", "gte", "lte"],
        }
