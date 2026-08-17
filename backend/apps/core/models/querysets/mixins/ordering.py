"""
Ordering queryset mixin.
"""

from __future__ import annotations


class OrderingQuerySetMixin:
    """
    Reusable ordering helpers.

    ``ordered()`` is provided by :class:`apps.core.models.querysets.base.BaseQuerySet`
    and is intentionally not duplicated here.
    """

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
