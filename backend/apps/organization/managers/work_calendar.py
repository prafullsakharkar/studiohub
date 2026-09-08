from typing import Any

from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.work_calendar import WorkCalendarQuerySet


class WorkCalendarManager(BaseManager):
    """Typed manager exposing WorkCalendarQuerySet helpers."""

    def get_queryset(self) -> WorkCalendarQuerySet:
        return WorkCalendarQuerySet(self.model, using=self._db)

    def default(self, *args: Any, **kwargs: Any):
        return self.get_queryset().default(*args, **kwargs)

    def with_timezone(self, *args: Any, **kwargs: Any):
        return self.get_queryset().with_timezone(*args, **kwargs)

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

    def by_name(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_name(*args, **kwargs)

    def by_uuid(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_uuid(*args, **kwargs)

    def ids(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ids(*args, **kwargs)

    def latest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().latest_first(*args, **kwargs)

    def oldest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest_first(*args, **kwargs)
