"""
Vendor contact write service.
"""

from __future__ import annotations

from apps.core.services.business import BusinessService
from apps.organization.events import (
    VendorContactCreated,
    VendorContactDeleted,
    VendorContactRestored,
    VendorContactUpdated,
)
from apps.organization.models import VendorContact


class VendorContactService(BusinessService):
    model = VendorContact

    event_map = {
        "create": VendorContactCreated,
        "update": VendorContactUpdated,
        "delete": VendorContactDeleted,
        "restore": VendorContactRestored,
    }
