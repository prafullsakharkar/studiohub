"""
Audit Log filter.
"""
from __future__ import annotations

from apps.audit.filters.base import AuditBaseFilter
from apps.audit.models.audit_log import AuditLog


class AuditLogFilter(AuditBaseFilter):
    """
    Filter for AuditLog.
    """

    class Meta:
        model = AuditLog
        fields = {
            "action": ["exact"],
            "severity": ["exact"],
            "target_type": ["exact"],
            "actor": ["exact"],
            "organization": ["exact"],
            "created_at": ["exact", "gte", "lte"],
        }
