from typing import Any

from apps.core.models.managers.base import BaseManager
from apps.identity.querysets.security_event import SecurityEventQuerySet


class SecurityEventManager(BaseManager):
    """Manager for SecurityEvent."""

    def get_queryset(self) -> SecurityEventQuerySet:
        return SecurityEventQuerySet(self.model, using=self._db)

    def for_user(self, *args: Any, **kwargs: Any):
        return self.get_queryset().for_user(*args, **kwargs)

    def by_type(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_type(*args, **kwargs)

    def by_event_type(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_event_type(*args, **kwargs)

    def recent(self, *args: Any, **kwargs: Any):
        return self.get_queryset().recent(*args, **kwargs)

    def ip_address(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ip_address(*args, **kwargs)

    def select_related_all(self, *args: Any, **kwargs: Any):
        return self.get_queryset().select_related_all(*args, **kwargs)

    def list_security_events(self, *args: Any, **kwargs: Any):
        return self.get_queryset().list_security_events(*args, **kwargs)

    def count_security_events(self, *args: Any, **kwargs: Any):
        return self.get_queryset().count_security_events(*args, **kwargs)

    def get_security_event_with_user(self, *args: Any, **kwargs: Any):
        return self.get_queryset().get_security_event_with_user(*args, **kwargs)

    def active(self, *args: Any, **kwargs: Any):
        return self.get_queryset().active(*args, **kwargs)

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
