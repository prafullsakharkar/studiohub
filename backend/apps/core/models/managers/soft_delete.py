"""
Soft delete managers.
"""

from __future__ import annotations

from apps.core.models.managers.base import BaseManager
from apps.core.models.querysets import SoftDeleteQuerySet


class SoftDeleteManager(BaseManager.from_queryset(SoftDeleteQuerySet)):
    """
    Default manager that excludes deleted objects.
    """

    def get_queryset(self) -> SoftDeleteQuerySet:
        return super().get_queryset().alive()


class AllObjectsManager(BaseManager.from_queryset(SoftDeleteQuerySet)):
    """
    Returns all objects including deleted.
    """

    def get_queryset(self) -> SoftDeleteQuerySet:
        return super().get_queryset()


class DeletedObjectsManager(BaseManager.from_queryset(SoftDeleteQuerySet)):
    """
    Returns only soft-deleted objects.
    """

    def get_queryset(self) -> SoftDeleteQuerySet:
        return super().get_queryset().deleted()
