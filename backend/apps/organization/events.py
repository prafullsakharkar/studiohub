from apps.core.events.base import DomainEvent


class OrganizationCreatedEvent(DomainEvent):
    event_type = "organization.created"


class OrganizationUpdatedEvent(DomainEvent):
    event_type = "organization.updated"


class OrganizationArchivedEvent(DomainEvent):
    event_type = "organization.archived"
