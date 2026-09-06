"""
Vendor contract write service.
"""

from __future__ import annotations

from apps.core.services.business import BusinessService
from apps.organization.models import VendorContract


class VendorContractService(BusinessService):
    model = VendorContract
