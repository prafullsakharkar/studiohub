"""
Login History filter.
"""
from __future__ import annotations

from apps.audit.filters.base import AuditBaseFilter
from apps.audit.models.login_history import LoginHistory


class LoginHistoryFilter(AuditBaseFilter):
    """
    Filter for LoginHistory.
    """

    class Meta:
        model = LoginHistory
        fields = {
            "login_type": ["exact"],
            "login_method": ["exact"],
            "status": ["exact"],
            "user": ["exact"],
            "organization": ["exact"],
            "created_at": ["exact", "gte", "lte"],
        }
