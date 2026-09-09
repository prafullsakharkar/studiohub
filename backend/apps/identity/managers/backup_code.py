from typing import Any

from apps.core.managers import BaseManager
from apps.identity.querysets.backup_code import BackupCodeQuerySet


class BackupCodeManager(BaseManager):
    """Manager for BackupCode."""

    def get_queryset(self) -> BackupCodeQuerySet:
        return BackupCodeQuerySet(self.model, using=self._db)

    def available(self, *args: Any, **kwargs: Any):
        return self.get_queryset().available(*args, **kwargs)

    def used(self, *args: Any, **kwargs: Any):
        return self.get_queryset().used(*args, **kwargs)

    def expired(self, *args: Any, **kwargs: Any):
        return self.get_queryset().expired(*args, **kwargs)

    def by_user(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_user(*args, **kwargs)

    def select_related_all(self, *args: Any, **kwargs: Any):
        return self.get_queryset().select_related_all(*args, **kwargs)

    def ids(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ids(*args, **kwargs)

    def ordered(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ordered(*args, **kwargs)

    def latest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().latest_first(*args, **kwargs)

    def oldest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest_first(*args, **kwargs)
