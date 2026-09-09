"""
Soft delete managers.
"""

from __future__ import annotations

from typing import Any

from apps.core.models.managers.base import BaseManager
from apps.core.models.querysets import SoftDeleteQuerySet


class SoftDeleteManager(BaseManager):
    """
    Default manager that excludes deleted objects.
    """

    def get_queryset(self) -> SoftDeleteQuerySet:
        return SoftDeleteQuerySet(self.model, using=self._db).alive()

    def alive(self, *args: Any, **kwargs: Any):
        return self.get_queryset().alive(*args, **kwargs)

    def deleted(self, *args: Any, **kwargs: Any):
        return self.get_queryset().deleted(*args, **kwargs)

    def with_deleted(self, *args: Any, **kwargs: Any):
        return self.get_queryset().with_deleted(*args, **kwargs)

    def active(self, *args: Any, **kwargs: Any):
        return self.get_queryset().active(*args, **kwargs)

    def inactive(self, *args: Any, **kwargs: Any):
        return self.get_queryset().inactive(*args, **kwargs)

    def search(self, *args: Any, **kwargs: Any):
        return self.get_queryset().search(*args, **kwargs)

    def ordered(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ordered(*args, **kwargs)

    def newest(self, *args: Any, **kwargs: Any):
        return self.get_queryset().newest(*args, **kwargs)

    def oldest(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest(*args, **kwargs)

    def ids(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ids(*args, **kwargs)

    def latest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().latest_first(*args, **kwargs)

    def oldest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest_first(*args, **kwargs)


class AllObjectsManager(BaseManager):
    """
    Returns all objects including deleted.
    """

    def get_queryset(self) -> SoftDeleteQuerySet:
        return SoftDeleteQuerySet(self.model, using=self._db)

    def alive(self, *args: Any, **kwargs: Any):
        return self.get_queryset().alive(*args, **kwargs)

    def deleted(self, *args: Any, **kwargs: Any):
        return self.get_queryset().deleted(*args, **kwargs)

    def with_deleted(self, *args: Any, **kwargs: Any):
        return self.get_queryset().with_deleted(*args, **kwargs)

    def active(self, *args: Any, **kwargs: Any):
        return self.get_queryset().active(*args, **kwargs)

    def inactive(self, *args: Any, **kwargs: Any):
        return self.get_queryset().inactive(*args, **kwargs)

    def search(self, *args: Any, **kwargs: Any):
        return self.get_queryset().search(*args, **kwargs)

    def ordered(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ordered(*args, **kwargs)

    def newest(self, *args: Any, **kwargs: Any):
        return self.get_queryset().newest(*args, **kwargs)

    def oldest(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest(*args, **kwargs)

    def ids(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ids(*args, **kwargs)

    def latest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().latest_first(*args, **kwargs)

    def oldest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest_first(*args, **kwargs)


class DeletedObjectsManager(BaseManager):
    """
    Returns only soft-deleted objects.
    """

    def get_queryset(self) -> SoftDeleteQuerySet:
        return SoftDeleteQuerySet(self.model, using=self._db).deleted()

    def alive(self, *args: Any, **kwargs: Any):
        return self.get_queryset().alive(*args, **kwargs)

    def deleted(self, *args: Any, **kwargs: Any):
        return self.get_queryset().deleted(*args, **kwargs)

    def with_deleted(self, *args: Any, **kwargs: Any):
        return self.get_queryset().with_deleted(*args, **kwargs)

    def active(self, *args: Any, **kwargs: Any):
        return self.get_queryset().active(*args, **kwargs)

    def inactive(self, *args: Any, **kwargs: Any):
        return self.get_queryset().inactive(*args, **kwargs)

    def search(self, *args: Any, **kwargs: Any):
        return self.get_queryset().search(*args, **kwargs)

    def ordered(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ordered(*args, **kwargs)

    def newest(self, *args: Any, **kwargs: Any):
        return self.get_queryset().newest(*args, **kwargs)

    def oldest(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest(*args, **kwargs)

    def ids(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ids(*args, **kwargs)

    def latest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().latest_first(*args, **kwargs)

    def oldest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest_first(*args, **kwargs)


__all__ = [
    "SoftDeleteManager",
    "AllObjectsManager",
    "DeletedObjectsManager",
]
