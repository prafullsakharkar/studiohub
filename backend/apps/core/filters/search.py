"""
Search filter mixin.
"""

from __future__ import annotations

from django.db.models import Q


class SearchFilterMixin:
    """
    Generic search across configured fields.
    """

    search_fields = ()

    def filter_search(self, queryset, name, value):
        if not value or not self.search_fields:
            return queryset

        query = Q()

        for field in self.search_fields:
            query |= Q(**{f"{field}__icontains": value})

        return queryset.filter(query)
