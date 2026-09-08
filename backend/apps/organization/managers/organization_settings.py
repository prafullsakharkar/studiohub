from typing import Any

from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.organization_settings import OrganizationSettingsQuerySet


class OrganizationSettingsManager(BaseManager):
    """Typed manager exposing OrganizationSettingsQuerySet helpers."""

    def get_queryset(self) -> OrganizationSettingsQuerySet:
        return OrganizationSettingsQuerySet(self.model, using=self._db)

    def with_organization(self, *args: Any, **kwargs: Any):
        return self.get_queryset().with_organization(*args, **kwargs)

    def for_organization(self, *args: Any, **kwargs: Any):
        return self.get_queryset().for_organization(*args, **kwargs)

    def ids(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ids(*args, **kwargs)

    def ordered(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ordered(*args, **kwargs)

    def latest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().latest_first(*args, **kwargs)

    def oldest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest_first(*args, **kwargs)
