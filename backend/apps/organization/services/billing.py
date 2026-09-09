"""
Organization billing write service.
"""

from __future__ import annotations

from apps.core.services.business import BusinessService
from apps.organization.events import OrganizationBillingUpdated
from apps.organization.models import OrganizationBilling
from apps.organization.validators.billing import OrganizationBillingValidator


class OrganizationBillingService(BusinessService):
    model = OrganizationBilling

    validator_class = OrganizationBillingValidator

    event_map = {
        "update": OrganizationBillingUpdated,
    }
