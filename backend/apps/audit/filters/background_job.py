"""
Background Job filter.
"""
from __future__ import annotations

from apps.audit.filters.base import AuditBaseFilter
from apps.audit.models.background_job import BackgroundJob


class BackgroundJobFilter(AuditBaseFilter):
    """
    Filter for BackgroundJob.
    """

    class Meta:
        model = BackgroundJob
        fields = {
            "job_type": ["exact"],
            "status": ["exact"],
            "organization": ["exact"],
            "created_at": ["exact", "gte", "lte"],
        }
