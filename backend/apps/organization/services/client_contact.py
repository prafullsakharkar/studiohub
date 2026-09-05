"""
Client contact write service.
"""

from __future__ import annotations

from apps.core.services.business import BusinessService
from apps.organization.models import ClientContact


class ClientContactService(BusinessService):
    model = ClientContact
