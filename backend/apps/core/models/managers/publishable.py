"""
Publishable managers.
"""

from __future__ import annotations

from typing import Any

from apps.core.models.managers.base import BaseManager
from apps.core.models.querysets import PublishableQuerySet


class PublishedManager(BaseManager):
    """
    Manager exposing only published records.
    """

    def get_queryset(self) -> PublishableQuerySet:
        return PublishableQuerySet(self.model, using=self._db).published()

    def published(self, *args: Any, **kwargs: Any):
        return self.get_queryset().published(*args, **kwargs)

    def unpublished(self, *args: Any, **kwargs: Any):
        return self.get_queryset().unpublished(*args, **kwargs)

    def scheduled(self, *args: Any, **kwargs: Any):
        return self.get_queryset().scheduled(*args, **kwargs)

    def ids(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ids(*args, **kwargs)

    def ordered(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ordered(*args, **kwargs)

    def latest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().latest_first(*args, **kwargs)

    def oldest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest_first(*args, **kwargs)


class AllPublishedManager(BaseManager):
    """
    Manager exposing all publishable records.
    """

    def get_queryset(self) -> PublishableQuerySet:
        return PublishableQuerySet(self.model, using=self._db)

    def published(self, *args: Any, **kwargs: Any):
        return self.get_queryset().published(*args, **kwargs)

    def unpublished(self, *args: Any, **kwargs: Any):
        return self.get_queryset().unpublished(*args, **kwargs)

    def scheduled(self, *args: Any, **kwargs: Any):
        return self.get_queryset().scheduled(*args, **kwargs)

    def ids(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ids(*args, **kwargs)

    def ordered(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ordered(*args, **kwargs)

    def latest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().latest_first(*args, **kwargs)

    def oldest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest_first(*args, **kwargs)


__all__ = ["PublishedManager", "AllPublishedManager"]
