from apps.core.events import DomainEvent


class OrganizationCreated(DomainEvent):
    event_type = "organization.created"


class OrganizationUpdated(DomainEvent):
    event_type = "organization.updated"


class OrganizationArchived(DomainEvent):
    event_type = "organization.archived"


class OrganizationDeleted(DomainEvent):
    event_type = "organization.deleted"


class OrganizationManagerAssigned(DomainEvent):
    event_type = "organization.manager_assigned"


class OrganizationMoved(DomainEvent):
    event_type = "organization.moved"


class OrganizationRestored(DomainEvent):
    event_type = "organization.restored"


class OrganizationActivated(DomainEvent):
    event_type = "organization.activated"


class OrganizationDeactivated(DomainEvent):
    event_type = "organization.deactivated"
