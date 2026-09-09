"""
Base QuerySet.

Provides common helper methods for all querysets.
"""

from __future__ import annotations

from typing import Any

from django.db import models


class BaseQuerySet(models.QuerySet[Any, Any]):
    """
    Base queryset shared across all models.

    NOTE: Lifecycle helpers (active/inactive/draft/archived) are provided by
    LifecycleQuerySetMixin so BaseQuerySet deliberately does not implement
    them to avoid duplicated/ambiguous semantics across different models.
    """

    def ids(self):
        """
        Return only object ids.
        """
        return self.values_list("id", flat=True)

    def ordered(self):  # pyright: ignore[reportIncompatibleMethodOverride]
        """
        Respect model ordering when defined on the model's Meta.

        NOTE: intentionally shadows Django's ``QuerySet.ordered`` boolean
        property with a chainable method (always call it: ``.ordered()``).
        """
        model = self.model
        if model is None:
            return self

        ordering = getattr(model._meta, "ordering", None)
        if ordering:
            return self.order_by(*ordering)

        return self

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
