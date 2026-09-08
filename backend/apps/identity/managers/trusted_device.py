from typing import Any

from apps.core.managers import BaseManager
from apps.identity.querysets.trusted_device import TrustedDeviceQuerySet


class TrustedDeviceManager(BaseManager):
    """Manager for TrustedDevice."""

    def get_queryset(self) -> TrustedDeviceQuerySet:
        return TrustedDeviceQuerySet(self.model, using=self._db)

    def trusted(self, *args: Any, **kwargs: Any):
        return self.get_queryset().trusted(*args, **kwargs)

    def revoked(self, *args: Any, **kwargs: Any):
        return self.get_queryset().revoked(*args, **kwargs)

    def expired(self, *args: Any, **kwargs: Any):
        return self.get_queryset().expired(*args, **kwargs)

    def active(self, *args: Any, **kwargs: Any):
        return self.get_queryset().active(*args, **kwargs)

    def by_user(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_user(*args, **kwargs)

    def for_user(self, *args: Any, **kwargs: Any):
        return self.get_queryset().for_user(*args, **kwargs)

    def by_fingerprint(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_fingerprint(*args, **kwargs)

    def by_ip(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_ip(*args, **kwargs)

    def by_platform(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_platform(*args, **kwargs)

    def recently_used(self, *args: Any, **kwargs: Any):
        return self.get_queryset().recently_used(*args, **kwargs)

    def select_related_all(self, *args: Any, **kwargs: Any):
        return self.get_queryset().select_related_all(*args, **kwargs)

    def list_trusted_devices(self, *args: Any, **kwargs: Any):
        return self.get_queryset().list_trusted_devices(*args, **kwargs)

    def count_trusted_devices(self, *args: Any, **kwargs: Any):
        return self.get_queryset().count_trusted_devices(*args, **kwargs)

    def get_trusted_device_with_user(self, *args: Any, **kwargs: Any):
        return self.get_queryset().get_trusted_device_with_user(*args, **kwargs)

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
