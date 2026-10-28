"""
Color service.
"""

from __future__ import annotations

import random

from .base import BaseService


class ColorService(BaseService):
    """
    Service for color operations.
    """

    @classmethod
    def random(cls):
        return f"#{random.randint(0, 0xFFFFFF):06X}"  # noqa: S311 - a display colour, not a secret

    @classmethod
    def normalize(cls, color: str):
        color = color.upper()

        if not color.startswith("#"):
            color = "#" + color

        return color
