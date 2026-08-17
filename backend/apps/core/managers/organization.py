"""
Organization-aware managers.

DEPRECATED: The organization application provides its own
``apps.organization.managers.OrganizationManager``. This class is kept in Core
for backward compatibility only. New code should use the organization
application's manager.
"""

from __future__ import annotations

from apps.core.models.managers.base import BaseManager
from apps.core.models.querysets import OrganizationQuerySet


class OrganizationManager(BaseManager.from_queryset(OrganizationQuerySet)):
    """
    Manager for organization-aware models.

    .. deprecated:: Use ``apps.organization.managers.OrganizationManager``.
    """

    pass
