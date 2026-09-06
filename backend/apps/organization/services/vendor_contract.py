"""
Vendor contract write service.
"""

from __future__ import annotations

from apps.core.services.business import BusinessService
from apps.organization.events import (
    VendorContractCreated,
    VendorContractDeleted,
    VendorContractRestored,
    VendorContractUpdated,
)
from apps.organization.models import VendorContract
from apps.organization.validators.vendor_contract import VendorContractValidator


class VendorContractService(BusinessService):
    model = VendorContract

    validator_class = VendorContractValidator

    event_map = {
        "create": VendorContractCreated,
        "update": VendorContractUpdated,
        "delete": VendorContractDeleted,
        "restore": VendorContractRestored,
    }
