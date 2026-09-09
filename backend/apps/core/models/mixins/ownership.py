"""
Ownership mixin.
"""

from __future__ import annotations


class OwnershipMixin:
    """
    Convenience methods for ownership checks.
    """

    def is_owner(self, user) -> bool:
        """
        Returns True if the given user owns this object.
        """
        return getattr(self, "owner", None) == user
