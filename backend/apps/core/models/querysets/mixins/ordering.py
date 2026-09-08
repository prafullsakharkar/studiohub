"""
Ordering queryset mixin.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, ClassVar, Self


class OrderingQuerySetMixin:
    """
    Reusable ordering helpers.
    """
    # Mixin contract: provided by the QuerySet subclass.
    order_by: ClassVar[Callable[..., Any]]
    model: ClassVar[Any]

    def ordered(self) -> Self:
        """
        Respect model ordering when defined on the model's Meta.

        Same semantics as ``BaseQuerySet.ordered`` for querysets composed
        from mixins without the base class.
        """
        model = self.model
        if model is None:
            return self

        ordering = getattr(model._meta, "ordering", None)
        if ordering:
            return self.order_by(*ordering)

        return self

    def newest(self):
        """
        Order by newest created objects.
        """
        return self.order_by("-created_at")

    def oldest(self):
        """
        Order by oldest created objects.
        """
        return self.order_by("created_at")
