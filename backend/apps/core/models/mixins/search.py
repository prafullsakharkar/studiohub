"""
Search mixin.
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
