"""
Soft delete filters.
"""

from __future__ import annotations

import django_filters


class SoftDeleteFilterMixin:

    deleted = django_filters.BooleanFilter(method="filter_deleted")

    def filter_deleted(
        self,
        queryset,
        name,
        value,
    ):
        if value:
            return queryset.deleted()

        return queryset.active()
