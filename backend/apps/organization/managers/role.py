from typing import Any

from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.role import RoleQuerySet


class RoleManager(BaseManager):
    """Typed manager exposing RoleQuerySet helpers."""

    def get_queryset(self) -> RoleQuerySet:
        return RoleQuerySet(self.model, using=self._db)

    def for_organization(self, *args: Any, **kwargs: Any):
        return self.get_queryset().for_organization(*args, **kwargs)

    def system(self, *args: Any, **kwargs: Any):
        return self.get_queryset().system(*args, **kwargs)

    def custom(self, *args: Any, **kwargs: Any):
        return self.get_queryset().custom(*args, **kwargs)

    def default(self, *args: Any, **kwargs: Any):
        return self.get_queryset().default(*args, **kwargs)

    def assignable(self, *args: Any, **kwargs: Any):
        return self.get_queryset().assignable(*args, **kwargs)

    def ordered(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ordered(*args, **kwargs)

    def with_permissions(self, *args: Any, **kwargs: Any):
        return self.get_queryset().with_permissions(*args, **kwargs)

    def ids(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ids(*args, **kwargs)

    def latest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().latest_first(*args, **kwargs)

    def oldest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest_first(*args, **kwargs)
