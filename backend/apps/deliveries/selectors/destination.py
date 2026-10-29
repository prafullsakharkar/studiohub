"""
Deliveries destination selector for query operations.
"""
from __future__ import annotations

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector
from apps.deliveries.models import DeliveryDestination


class DestinationSelector(BaseSelector):
    """
    Read-side data access for delivery destinations (platform-global).
    """

    model = DeliveryDestination

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[DeliveryDestination]:
        return cls.model.objects.all()
