"""
Filter mixin.
"""
from __future__ import annotations


class FilterMixin:
    """
    Hook for additional queryset filtering.
    """

    def filter_queryset(self, queryset):
        return super().filter_queryset(queryset)
