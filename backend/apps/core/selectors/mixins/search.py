"""
Search mixin for selectors.
"""
from __future__ import annotations

from apps.core.services import SearchService


class SearchMixin:
    """
    Search helper methods.
    """

    @staticmethod
    def normalize_search(value: str):
        return SearchService.normalize(value)

    def search_queryset(self, queryset, search, fields=None):
        """
        Apply search filtering to queryset.
        """
        if not search:
            return queryset

        search_value = self.normalize_search(search)
        if not search_value:
            return queryset

        if fields:
            from django.db.models import Q
            query = Q()
            for field in fields:
                query |= Q(**{f"{field}__icontains": search_value})
            return queryset.filter(query)

        return queryset
