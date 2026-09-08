from typing import Any

from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.permission import PermissionQuerySet


class PermissionManager(BaseManager):
    """Typed manager exposing PermissionQuerySet helpers."""

    def get_queryset(self) -> PermissionQuerySet:
        return PermissionQuerySet(self.model, using=self._db)

    def by_module(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_module(*args, **kwargs)

    def by_action(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_action(*args, **kwargs)

    def by_category(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_category(*args, **kwargs)

    def system(self, *args: Any, **kwargs: Any):
        return self.get_queryset().system(*args, **kwargs)

    def custom(self, *args: Any, **kwargs: Any):
        return self.get_queryset().custom(*args, **kwargs)

    def ids(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ids(*args, **kwargs)

    def ordered(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ordered(*args, **kwargs)

    def latest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().latest_first(*args, **kwargs)

    def oldest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest_first(*args, **kwargs)
