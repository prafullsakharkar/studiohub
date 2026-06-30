"""
Ordering queryset mixin.
"""

from __future__ import annotations


class OrderingQuerySetMixin:
    """
    Reusable ordering helpers.
    """

    def ordered(self):
        """
        Apply the model's default ordering.
        """
        ordering = getattr(self.model._meta, "ordering", None)

        if ordering:
            return self.order_by(*ordering)

        return self

    def newest(self):
        """
        Order by newest created objects.
        """
        return self.order_by("-created_at")

    def oldest(self):
        """
        Order by oldest created objects.
        """
        return self.order_by("created_at")
