from typing import Any

from apps.core.models.managers.base import BaseManager
from apps.identity.querysets.ip_blacklist import IPBlacklistQuerySet


class IPBlacklistManager(BaseManager):
    """Manager for IPBlacklist."""

    def get_queryset(self) -> IPBlacklistQuerySet:
        return IPBlacklistQuerySet(self.model, using=self._db)

    def active(self, *args: Any, **kwargs: Any):
        return self.get_queryset().active(*args, **kwargs)

    def inactive(self, *args: Any, **kwargs: Any):
        return self.get_queryset().inactive(*args, **kwargs)

    def expired(self, *args: Any, **kwargs: Any):
        return self.get_queryset().expired(*args, **kwargs)

    def by_ip(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_ip(*args, **kwargs)

    def by_network(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_network(*args, **kwargs)

    def by_user(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_user(*args, **kwargs)

    def is_blacklisted(self, *args: Any, **kwargs: Any):
        return self.get_queryset().is_blacklisted(*args, **kwargs)

    def select_related_all(self, *args: Any, **kwargs: Any):
        return self.get_queryset().select_related_all(*args, **kwargs)

    def list_ip_blacklist(self, *args: Any, **kwargs: Any):
        return self.get_queryset().list_ip_blacklist(*args, **kwargs)

    def count_ip_blacklist(self, *args: Any, **kwargs: Any):
        return self.get_queryset().count_ip_blacklist(*args, **kwargs)

    def is_ip_blacklisted(self, *args: Any, **kwargs: Any):
        return self.get_queryset().is_ip_blacklisted(*args, **kwargs)

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
