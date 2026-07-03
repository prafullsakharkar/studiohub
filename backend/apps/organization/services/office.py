"""
Office write service.
"""

from __future__ import annotations

from apps.core.services.business import BusinessService
from apps.organization.events import (
    OfficeActivated,
    OfficeArchived,
    OfficeCreated,
    OfficeDeactivated,
    OfficeDeleted,
    OfficeRestored,
    OfficeUpdated,
)
from apps.organization.models import Office
from apps.organization.validators.office import (
    OfficeValidator,
)


class OfficeService(BusinessService):
    """
    Handles all write operations for Office.
    """

    model = Office

    validator_class = OfficeValidator

    event_map = {
        "create": OfficeCreated,
        "update": OfficeUpdated,
        "delete": OfficeDeleted,
        "restore": OfficeRestored,
        "archive": OfficeArchived,
        "activate": OfficeActivated,
        "deactivate": OfficeDeactivated,
    }
