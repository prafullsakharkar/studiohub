from apps.core.events import BaseEvent


class OrganizationCreated(BaseEvent):
    event_type = "organization.created"


class OrganizationUpdated(BaseEvent):
    event_type = "organization.updated"


class OrganizationArchived(BaseEvent):
    event_type = "organization.archived"


class OrganizationDeleted(BaseEvent):
    event_type = "organization.deleted"


class OrganizationManagerAssigned(BaseEvent):
    event_type = "organization.manager_assigned"


class OrganizationMoved(BaseEvent):
    event_type = "organization.moved"
