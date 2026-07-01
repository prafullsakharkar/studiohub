"""
Base FilterSet.
"""

from __future__ import annotations

import django_filters


class BaseFilterSet(django_filters.FilterSet):
    """
    Base filter for all models.
    """

    search = django_filters.CharFilter(
        method="filter_search",
        label="Search",
    )

    ordering = django_filters.OrderingFilter()

    def filter_search(self, queryset, name, value):
        """
        Override in subclasses.
        """
        return queryset

    class Meta:
        abstract = True
