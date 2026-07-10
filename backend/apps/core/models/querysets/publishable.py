"""
Publishable queryset.
"""

from __future__ import annotations

from apps.core.models.querysets.base import BaseQuerySet
from apps.core.models.querysets.mixins.publishable import (
    PublishableQuerySetMixin,
)


class PublishableQuerySet(
    PublishableQuerySetMixin,
    BaseQuerySet,
):
    """
    QuerySet for publishable models.
    """

    pass
