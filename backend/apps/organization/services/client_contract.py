"""
Client contract write service.
"""

from __future__ import annotations

from apps.core.services.business import BusinessService
from apps.organization.events import (
    ClientContractCreated,
    ClientContractDeleted,
    ClientContractRestored,
    ClientContractUpdated,
)
from apps.organization.models import ClientContract
from apps.organization.validators.client_contract import ClientContractValidator


class ClientContractService(BusinessService):
    model = ClientContract

    validator_class = ClientContractValidator

    event_map = {
        "create": ClientContractCreated,
        "update": ClientContractUpdated,
        "delete": ClientContractDeleted,
        "restore": ClientContractRestored,
    }
