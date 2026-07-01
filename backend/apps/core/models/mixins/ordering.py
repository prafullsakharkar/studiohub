"""
Ordering mixin.
"""

from __future__ import annotations

from apps.core.services import OrderingService


class OrderingMixin:
    """
    Ordering helper methods.
    """

    def move_up(self):
        return OrderingService.move_up(self)

    def move_down(self):
        return OrderingService.move_down(self)

    def move_to(self, position: int):
        return OrderingService.move_to(
            self,
            position,
        )
