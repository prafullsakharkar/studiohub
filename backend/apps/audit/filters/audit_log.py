"""
Audit Log filter.
"""
from __future__ import annotations

import django_filters

from apps.audit.filters.base import AuditBaseFilter
from apps.audit.models.audit_log import AuditLog


class AuditLogFilter(AuditBaseFilter):
    """
    Filter for AuditLog.
    """

    # Frontend contract sends UPPERCASE actions (UPDATE, APPROVE, …) while the
    # DB stores lowercase choices: match case-insensitively instead of the
    # auto-generated ChoiceFilter (which 400/empties on frontend values).
    action = django_filters.CharFilter(field_name="action", lookup_expr="iexact")

    class Meta:
        model = AuditLog
        fields = {
            "severity": ["exact"],
            "target_type": ["exact"],
            "actor": ["exact"],
            "organization": ["exact"],
            "created_at": ["exact", "gte", "lte"],
        }
