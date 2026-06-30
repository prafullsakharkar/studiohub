"""
Soft delete queryset mixin.
"""

from __future__ import annotations


class SoftDeleteQuerySetMixin:
    """
    Reusable queryset methods for soft-deletable models.
    """

    def alive(self):
        """
        Return only non-deleted records.
        """
        return self.filter(is_deleted=False)

    def deleted(self):
        """
        Return only soft-deleted records.
        """
        return self.filter(is_deleted=True)

    def with_deleted(self):
        """
        Return the queryset unchanged.

        Exists for readability when chaining.
        """
        return self

    def active(self):
        """
        Return active records.
        """
        return self.filter(
            is_deleted=False,
            status="active",
        )

    def inactive(self):
        """
        Return inactive records.
        """
        return self.exclude(status="active")
