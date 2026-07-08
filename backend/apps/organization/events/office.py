from apps.core.events import DomainEvent


class OfficeCreated(DomainEvent):
    event_type = "organization.office.created"


class OfficeUpdated(DomainEvent):
    event_type = "organization.office.updated"


class OfficeArchived(DomainEvent):
    event_type = "organization.office.archived"


class OfficeActivated(DomainEvent):
    event_type = "organization.office.activated"


class OfficeDeactivated(DomainEvent):
    event_type = "organization.office.deactivated"


class OfficeRestored(DomainEvent):
    event_type = "organization.office.restored"


class OfficeDeleted(DomainEvent):
    event_type = "organization.office.deleted"


class OfficeManagerAssigned(DomainEvent):
    event_type = "organization.office.manager_assigned"


class OfficeHeadquartersChanged(DomainEvent):
    event_type = "organization.office.headquarters_changed"
