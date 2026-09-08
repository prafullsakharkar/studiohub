from typing import Any

from apps.core.managers import BaseManager
from apps.identity.querysets.user_mfa import UserMFAQuerySet


class UserMFAManager(BaseManager):
    """Manager for UserMFA."""

    def get_queryset(self) -> UserMFAQuerySet:
        return UserMFAQuerySet(self.model, using=self._db)

    def enabled(self, *args: Any, **kwargs: Any):
        return self.get_queryset().enabled(*args, **kwargs)

    def disabled(self, *args: Any, **kwargs: Any):
        return self.get_queryset().disabled(*args, **kwargs)

    def verified(self, *args: Any, **kwargs: Any):
        return self.get_queryset().verified(*args, **kwargs)

    def pending(self, *args: Any, **kwargs: Any):
        return self.get_queryset().pending(*args, **kwargs)

    def active(self, *args: Any, **kwargs: Any):
        return self.get_queryset().active(*args, **kwargs)

    def locked(self, *args: Any, **kwargs: Any):
        return self.get_queryset().locked(*args, **kwargs)

    def by_user(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_user(*args, **kwargs)

    def by_method(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_method(*args, **kwargs)

    def select_related_all(self, *args: Any, **kwargs: Any):
        return self.get_queryset().select_related_all(*args, **kwargs)

    def inactive(self, *args: Any, **kwargs: Any):
        return self.get_queryset().inactive(*args, **kwargs)

    def system(self, *args: Any, **kwargs: Any):
        return self.get_queryset().system(*args, **kwargs)

    def custom(self, *args: Any, **kwargs: Any):
        return self.get_queryset().custom(*args, **kwargs)

    def by_name(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_name(*args, **kwargs)

    def by_code(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_code(*args, **kwargs)

    def search(self, *args: Any, **kwargs: Any):
        return self.get_queryset().search(*args, **kwargs)

    def get_by_id(self, *args: Any, **kwargs: Any):
        return self.get_queryset().get_by_id(*args, **kwargs)

    def count_all(self, *args: Any, **kwargs: Any):
        return self.get_queryset().count_all(*args, **kwargs)

    def ids(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ids(*args, **kwargs)

    def ordered(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ordered(*args, **kwargs)

    def latest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().latest_first(*args, **kwargs)

    def oldest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest_first(*args, **kwargs)
