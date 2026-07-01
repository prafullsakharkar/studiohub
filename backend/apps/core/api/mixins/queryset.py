"""
Queryset mixin.
"""

from __future__ import annotations


class QuerysetMixin:
    """
    Query optimization helpers.
    """

    select_related = ()

    prefetch_related = ()

    def get_queryset(self):
        queryset = super().get_queryset()

        if self.select_related:
            queryset = queryset.select_related(*self.select_related)

        if self.prefetch_related:
            queryset = queryset.prefetch_related(*self.prefetch_related)

        return queryset
