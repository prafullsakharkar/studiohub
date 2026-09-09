"""
Soft delete queryset mixin.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, ClassVar


class SoftDeleteQuerySetMixin:
    """
    Reusable queryset methods for soft-deletable models.
    """
    # Mixin contract: provided by the QuerySet subclass.
    filter: ClassVar[Callable[..., Any]]

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
        Return active (non-deleted) records.
        """
        return self.filter(is_deleted=False)

    def inactive(self):
        """
        Return inactive (deleted) records.
        """
        return self.filter(is_deleted=True)
