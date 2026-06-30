"""
Base QuerySet.

Provides common helper methods for all querysets.
"""

from __future__ import annotations

from django.db import models


class BaseQuerySet(models.QuerySet):
    """
    Base queryset shared across all models.
    """

    def active(self):
        """
        Return active records.
        """
        if hasattr(self.model, "status"):
            return self.filter(status="active")

        return self

    def inactive(self):
        """
        Return inactive records.
        """
        if hasattr(self.model, "status"):
            return self.exclude(status="active")

        return self

    def ids(self):
        """
        Return only object ids.
        """
        return self.values_list("id", flat=True)

    def ordered(self):
        """
        Respect model ordering.
        """
        return self.order_by(*self.model._meta.ordering)

    def latest_first(self):
        """
        Latest created objects first.
        """
        if hasattr(self.model, "created_at"):
            return self.order_by("-created_at")

        return self

    def oldest_first(self):
        """
        Oldest created objects first.
        """
        if hasattr(self.model, "created_at"):
            return self.order_by("created_at")

        return self
