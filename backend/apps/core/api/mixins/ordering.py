"""
Ordering mixin.
"""
from __future__ import annotations


class OrderingMixin:
    """
    Hook for additional queryset ordering.
    """

    def order_queryset(self, queryset):
        return super().order_queryset(queryset)
