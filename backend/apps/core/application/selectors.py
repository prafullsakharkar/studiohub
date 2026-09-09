# selectors.py
"""
Application layer selectors.
"""

from __future__ import annotations

from apps.core.selectors.base import BaseSelector

__all__ = [
    "BaseSelector",
    "Selector",
]


class Selector(BaseSelector):
    """
    Alias for BaseSelector for application layer.
    """
