"""
Client contract write service.
"""

from __future__ import annotations

from apps.core.services.business import BusinessService
from apps.organization.models import ClientContract


class ClientContractService(BusinessService):
    model = ClientContract
