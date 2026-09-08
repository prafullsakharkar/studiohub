from typing import Any

from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.office import OfficeQuerySet


class OfficeManager(BaseManager):
    """Typed manager exposing OfficeQuerySet helpers."""

    def get_queryset(self) -> OfficeQuerySet:
        return OfficeQuerySet(self.model, using=self._db)

    def headquarters(self, *args: Any, **kwargs: Any):
        return self.get_queryset().headquarters(*args, **kwargs)

    def by_city(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_city(*args, **kwargs)

    def by_country(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_country(*args, **kwargs)

    def by_timezone(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_timezone(*args, **kwargs)

    def by_manager(self, *args: Any, **kwargs: Any):
        return self.get_queryset().by_manager(*args, **kwargs)

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
