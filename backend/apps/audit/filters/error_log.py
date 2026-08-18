"""
Error Log filter.
"""
from __future__ import annotations

from apps.audit.filters.base import AuditBaseFilter
from apps.audit.models.error_log import ErrorLog


class ErrorLogFilter(AuditBaseFilter):
    """
    Filter for ErrorLog.
    """

    class Meta:
        model = ErrorLog
        fields = {
            "severity": ["exact"],
            "error_type": ["exact"],
            "user": ["exact"],
            "organization": ["exact"],
            "created_at": ["exact", "gte", "lte"],
        }
