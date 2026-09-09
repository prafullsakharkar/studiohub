"""
Date filters.
"""

from __future__ import annotations

import django_filters


class DateRangeFilterMixin(django_filters.FilterSet):
    """
    Common date filters.

    Subclassing ``FilterSet`` (with an abstract ``Meta``) makes the declared
    date filters visible to django-filter's metaclass, which only inspects
    class attributes and bases that are themselves FilterSets.
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

    class Meta:
        abstract = True
