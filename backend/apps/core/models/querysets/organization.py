"""
Organization-aware queryset.

DEPRECATED: The organization application provides its own
``apps.organization.querysets.OrganizationQuerySet``. This class is kept in
Core for backward compatibility only. New code should use the organization
application's queryset.
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

    .. deprecated:: Use ``apps.organization.querysets.OrganizationQuerySet``.
    """

    pass
