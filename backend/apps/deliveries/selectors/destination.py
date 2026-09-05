"""
Deliveries destination selector for query operations.
"""
from __future__ import annotations

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector
from apps.deliveries.models import DeliveryDestination


class DestinationSelector(BaseSelector):
    """
    Read-side data access for delivery destinations.

    Organization scoping is applied by the viewset through
    ``scope_by_request`` (fail closed).
    """

    model = DeliveryDestination

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        return cls.model.objects.select_related(
            "organization",
        )
