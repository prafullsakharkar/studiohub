"""
Color mixin.
"""

from __future__ import annotations

from apps.core.services import ColorService


class ColorMixin:
    """
    Color helper methods.
    """

    @staticmethod
    def random_color():
        return ColorService.random()

    @staticmethod
    def normalize_color(color: str):
        return ColorService.normalize(color)
