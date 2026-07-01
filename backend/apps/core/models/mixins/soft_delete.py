"""
Soft delete mixin.
"""

from __future__ import annotations

from apps.core.services import SoftDeleteService


class SoftDeleteMixin:
    """
    Soft delete helper methods.
    """

    def soft_delete(self, *, user=None):
        return SoftDeleteService.delete(
            self,
            user=user,
        )

    def restore(self):
        return SoftDeleteService.restore(self)

    def hard_delete(self):
        return SoftDeleteService.hard_delete(self)
