"""
Base filter for Audit bounded context.
"""
from __future__ import annotations

from typing import Any

from django_filters import FilterSet

from apps.core.filters import BaseFilterSet


class AuditBaseFilter(BaseFilterSet):
    """
    Base filter for Audit entities.
    """

    def __init__(self, queryset=None, **kwargs: Any):
        # The audit viewsets call ``filter_class(queryset, data=params)``
        # while django_filters.FilterSet expects ``(data, queryset)`` —
        # translate so both call styles work.
        data = kwargs.pop("data", None)
        super().__init__(data=data, queryset=queryset, **kwargs)

    class Meta:
        abstract = True
