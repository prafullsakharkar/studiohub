from typing import Any

from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.group_member import GroupMemberQuerySet


class GroupMemberManager(BaseManager):
    """Typed manager exposing GroupMemberQuerySet helpers."""

    def get_queryset(self) -> GroupMemberQuerySet:
        return GroupMemberQuerySet(self.model, using=self._db)

    def for_group(self, *args: Any, **kwargs: Any):
        return self.get_queryset().for_group(*args, **kwargs)

    def for_user(self, *args: Any, **kwargs: Any):
        return self.get_queryset().for_user(*args, **kwargs)

    def owners(self, *args: Any, **kwargs: Any):
        return self.get_queryset().owners(*args, **kwargs)

    def managers(self, *args: Any, **kwargs: Any):
        return self.get_queryset().managers(*args, **kwargs)

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
