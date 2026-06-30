"""
Soft delete queryset.
"""

from __future__ import annotations

from apps.core.models.querysets.base import BaseQuerySet
from apps.core.models.querysets.mixins import (
    OrderingQuerySetMixin,
    SearchQuerySetMixin,
    SoftDeleteQuerySetMixin,
)


class SoftDeleteQuerySet(
    SearchQuerySetMixin,
    OrderingQuerySetMixin,
    SoftDeleteQuerySetMixin,
    BaseQuerySet,
):
    """
    QuerySet for models supporting soft deletion.
    """

    pass
