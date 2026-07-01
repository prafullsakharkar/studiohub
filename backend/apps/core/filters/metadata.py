"""
Metadata filters.
"""

from __future__ import annotations

import django_filters


class MetadataFilterMixin:
    """
    JSON metadata filtering.
    """

    metadata_key = django_filters.CharFilter(method="filter_metadata")

    def filter_metadata(self, queryset, name, value):
        return queryset.filter(metadata__has_key=value)
