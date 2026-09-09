"""
Active manager.
"""

from __future__ import annotations

from apps.core.models.managers.base import BaseManager
from apps.core.models.querysets import SoftDeleteQuerySet


class ActiveManager(BaseManager):
    """
    Manager exposing only active (non-deleted) objects.
    """

    def get_queryset(self) -> SoftDeleteQuerySet:
        return SoftDeleteQuerySet(self.model, using=self._db).active()
