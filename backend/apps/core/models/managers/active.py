"""
Active manager.
"""

from __future__ import annotations

from apps.core.models.managers.base import BaseManager


class ActiveManager(BaseManager):
    """
    Manager exposing only active objects.
    """

    def get_queryset(self):
        return super().get_queryset().active()
