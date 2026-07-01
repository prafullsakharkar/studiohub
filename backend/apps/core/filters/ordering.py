"""
Ordering filter mixin.
"""

from __future__ import annotations


class OrderingFilterMixin:
    """
    Default ordering configuration.
    """

    ordering_fields = "__all__"

    ordering = ("-created_at",)
