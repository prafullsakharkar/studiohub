from typing import Any

from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.role_permission import RolePermissionQuerySet


class RolePermissionManager(BaseManager):
    """Typed manager exposing RolePermissionQuerySet helpers."""

    def get_queryset(self) -> RolePermissionQuerySet:
        return RolePermissionQuerySet(self.model, using=self._db)

    def for_role(self, *args: Any, **kwargs: Any):
        return self.get_queryset().for_role(*args, **kwargs)

    def for_permission(self, *args: Any, **kwargs: Any):
        return self.get_queryset().for_permission(*args, **kwargs)

    def granted(self, *args: Any, **kwargs: Any):
        return self.get_queryset().granted(*args, **kwargs)

    def revoked(self, *args: Any, **kwargs: Any):
        return self.get_queryset().revoked(*args, **kwargs)

    def with_related(self, *args: Any, **kwargs: Any):
        return self.get_queryset().with_related(*args, **kwargs)

    def ids(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ids(*args, **kwargs)

    def ordered(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ordered(*args, **kwargs)

    def latest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().latest_first(*args, **kwargs)

    def oldest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest_first(*args, **kwargs)
