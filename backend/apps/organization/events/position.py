from apps.core.events import DomainEvent


class PositionCreated(DomainEvent):
    event_type = "organization.position.created"


class PositionUpdated(DomainEvent):
    event_type = "organization.position.updated"


class PositionArchived(DomainEvent):
    event_type = "organization.position.archived"


class PositionActivated(DomainEvent):
    event_type = "organization.position.activated"


class PositionDeactivated(DomainEvent):
    event_type = "organization.position.deactivated"


class PositionRestored(DomainEvent):
    event_type = "organization.position.restored"


class PositionDeleted(DomainEvent):
    event_type = "organization.position.deleted"
