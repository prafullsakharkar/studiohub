"""
Soft delete mixin.
"""

from __future__ import annotations

from typing import Any

from apps.core.services import SoftDeleteService


class SoftDeleteMixin:
    """
    Soft delete helper methods.
    """

    def soft_delete(self, *, user: Any = None) -> None:
        return SoftDeleteService.delete(
            self,
            user=user,
        )

    def restore(self) -> None:
        return SoftDeleteService.restore(self)

    def hard_delete(self) -> None:
        return SoftDeleteService.hard_delete(self)
