from typing import Any

from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.calendar_event import CalendarEventQuerySet


class CalendarEventManager(BaseManager):
    """Typed manager exposing CalendarEventQuerySet helpers."""

    def get_queryset(self) -> CalendarEventQuerySet:
        return CalendarEventQuerySet(self.model, using=self._db)

    def active(self, *args: Any, **kwargs: Any):
        return self.get_queryset().active(*args, **kwargs)

    def inactive(self, *args: Any, **kwargs: Any):
        return self.get_queryset().inactive(*args, **kwargs)

    def by_code(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_code(*args, **kwargs)

    def search(self, *args: Any, **kwargs: Any):
        return self.get_queryset().search(*args, **kwargs)

    def ordered(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ordered(*args, **kwargs)

    def for_organization(self, *args: Any, **kwargs: Any):
        return self.get_queryset().for_organization(*args, **kwargs)

    def upcoming(self, *args: Any, **kwargs: Any):
        return self.get_queryset().upcoming(*args, **kwargs)

    def by_type(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_type(*args, **kwargs)
