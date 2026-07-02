from apps.core.events.base import BaseEvent


class OrganizationCreatedEvent(BaseEvent):
    event_type = "organization.created"


class OrganizationUpdatedEvent(BaseEvent):
    event_type = "organization.updated"


class OrganizationArchivedEvent(BaseEvent):
    event_type = "organization.archived"
