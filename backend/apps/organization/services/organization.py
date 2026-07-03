"""
Organization write service.
"""

from __future__ import annotations

from apps.core.services.business import BusinessService
from apps.organization.events import (
    OrganizationActivated,
    OrganizationArchived,
    OrganizationCreated,
    OrganizationDeactivated,
    OrganizationDeleted,
    OrganizationRestored,
    OrganizationUpdated,
)
from apps.organization.models import Organization
from apps.organization.validators.organization import (
    OrganizationValidator,
)


class OrganizationService(BusinessService):
    """
    Handles all write operations for Organization.
    """

    model = Organization

    validator_class = OrganizationValidator

    event_map = {
        "create": OrganizationCreated,
        "update": OrganizationUpdated,
        "delete": OrganizationDeleted,
        "restore": OrganizationRestored,
        "activate": OrganizationActivated,
        "deactivate": OrganizationDeactivated,
        "archive": OrganizationArchived,
    }
