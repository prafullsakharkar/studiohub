"""
API Request filter.
"""
from __future__ import annotations

from apps.audit.filters.base import AuditBaseFilter
from apps.audit.models.api_request import APIRequest


class APIRequestFilter(AuditBaseFilter):
    """
    Filter for APIRequest.
    """

    class Meta:
        model = APIRequest
        fields = {
            "method": ["exact"],
            "status_code": ["exact"],
            "user": ["exact"],
            "organization": ["exact"],
            "created_at": ["exact", "gte", "lte"],
        }
