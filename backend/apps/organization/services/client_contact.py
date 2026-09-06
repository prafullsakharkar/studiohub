"""
Client contact write service.
"""

from __future__ import annotations

from apps.core.services.business import BusinessService
from apps.organization.events import (
    ClientContactCreated,
    ClientContactDeleted,
    ClientContactRestored,
    ClientContactUpdated,
)
from apps.organization.models import ClientContact


class ClientContactService(BusinessService):
    model = ClientContact

    event_map = {
        "create": ClientContactCreated,
        "update": ClientContactUpdated,
        "delete": ClientContactDeleted,
        "restore": ClientContactRestored,
    }
