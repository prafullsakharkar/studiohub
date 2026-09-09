from typing import Any

from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.user_role import UserRoleQuerySet


class UserRoleManager(BaseManager):
    """Typed manager exposing UserRoleQuerySet helpers."""

    def get_queryset(self) -> UserRoleQuerySet:
        return UserRoleQuerySet(self.model, using=self._db)

    def for_user(self, *args: Any, **kwargs: Any):
        return self.get_queryset().for_user(*args, **kwargs)

    def for_role(self, *args: Any, **kwargs: Any):
        return self.get_queryset().for_role(*args, **kwargs)

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
