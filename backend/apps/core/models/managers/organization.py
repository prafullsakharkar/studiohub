"""
Organization-aware managers.
"""

from __future__ import annotations

from typing import Any

from apps.core.models.managers.base import BaseManager
from apps.core.models.querysets import OrganizationQuerySet


class OrganizationManager(BaseManager):
    """
    Manager for organization-aware models.
    """

    def get_queryset(self) -> OrganizationQuerySet:
        return OrganizationQuerySet(self.model, using=self._db)

    def organization(self, *args: Any, **kwargs: Any):
        return self.get_queryset().organization(*args, **kwargs)

    def ids(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ids(*args, **kwargs)

    def ordered(self, *args: Any, **kwargs: Any):
        return self.get_queryset().ordered(*args, **kwargs)

    def latest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().latest_first(*args, **kwargs)

    def oldest_first(self, *args: Any, **kwargs: Any):
        return self.get_queryset().oldest_first(*args, **kwargs)
