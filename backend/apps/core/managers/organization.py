"""
Organization-aware managers.
"""

from __future__ import annotations

from apps.core.models.managers.base import BaseManager
from apps.core.models.querysets import OrganizationQuerySet


class OrganizationManager(BaseManager.from_queryset(OrganizationQuerySet)):
    """
    Manager for organization-aware models.
    """

    pass
