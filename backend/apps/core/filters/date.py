"""
Date filters.
"""

from __future__ import annotations

import django_filters


class DateRangeFilterMixin:
    """
    Common date filters.
    """

    created_after = django_filters.DateFilter(
        field_name="created_at",
        lookup_expr="gte",
    )

    created_before = django_filters.DateFilter(
        field_name="created_at",
        lookup_expr="lte",
    )

    updated_after = django_filters.DateFilter(
        field_name="updated_at",
        lookup_expr="gte",
    )

    updated_before = django_filters.DateFilter(
        field_name="updated_at",
        lookup_expr="lte",
    )
