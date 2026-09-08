from typing import Any

from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.personal_access_token import PersonalAccessTokenQuerySet


class PersonalAccessTokenManager(BaseManager):
    """Typed manager exposing PersonalAccessTokenQuerySet helpers."""

    def get_queryset(self) -> PersonalAccessTokenQuerySet:
        return PersonalAccessTokenQuerySet(self.model, using=self._db)

    def active(self, *args: Any, **kwargs: Any):
        return self.get_queryset().active(*args, **kwargs)

    def inactive(self, *args: Any, **kwargs: Any):
        return self.get_queryset().inactive(*args, **kwargs)

    def expired(self, *args: Any, **kwargs: Any):
        return self.get_queryset().expired(*args, **kwargs)

    def not_expired(self, *args: Any, **kwargs: Any):
        return self.get_queryset().not_expired(*args, **kwargs)

    def for_user(self, *args: Any, **kwargs: Any):
        return self.get_queryset().for_user(*args, **kwargs)

    def with_prefix(self, *args: Any, **kwargs: Any):
        return self.get_queryset().with_prefix(*args, **kwargs)

    def with_scope(self, *args: Any, **kwargs: Any):
        return self.get_queryset().with_scope(*args, **kwargs)

    def used(self, *args: Any, **kwargs: Any):
        return self.get_queryset().used(*args, **kwargs)

    def unused(self, *args: Any, **kwargs: Any):
        return self.get_queryset().unused(*args, **kwargs)

    def ids(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ids(*args, **kwargs)

    def ordered(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ordered(*args, **kwargs)

    def latest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().latest_first(*args, **kwargs)

    def oldest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest_first(*args, **kwargs)
