"""
Reusable search queryset mixin.
"""

from django.db.models import Q


class SearchQuerySetMixin:
    """
    Adds generic search capability.
    """

    search_fields: tuple[str, ...] = ()

    def search(self, value: str):
        if not value:
            return self

        query = Q()

        for field in self.search_fields:
            query |= Q(**{f"{field}__icontains": value})

        return self.filter(query)
