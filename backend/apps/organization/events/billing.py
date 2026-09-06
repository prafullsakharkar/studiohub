from apps.core.events import DomainEvent


class OrganizationBillingUpdated(DomainEvent):
    event_type = "organization.billing.updated"
