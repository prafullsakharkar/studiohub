"""
Selector mixin.
"""
from __future__ import annotations


class SelectorMixin:
    """
    Hook for additional queryset selection.
    """

    def select_queryset(self, queryset):
        return super().select_queryset(queryset)
