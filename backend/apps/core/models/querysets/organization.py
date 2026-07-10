"""
Organization-aware queryset.
"""

from __future__ import annotations

from apps.core.models.querysets.base import BaseQuerySet
from apps.core.models.querysets.mixins.organization import (
    OrganizationQuerySetMixin,
)


class OrganizationQuerySet(
    OrganizationQuerySetMixin,
    BaseQuerySet,
):
    """
    QuerySet for organization-scoped models.
    """

    pass
