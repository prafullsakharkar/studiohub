from apps.core.events import BaseEvent


class PositionCreated(BaseEvent):
    event_type = "organization.position.created"


class PositionUpdated(BaseEvent):
    event_type = "organization.position.updated"


class PositionArchived(BaseEvent):
    event_type = "organization.position.archived"


class PositionActivated(BaseEvent):
    event_type = "organization.position.activated"


class PositionDeactivated(BaseEvent):
    event_type = "organization.position.deactivated"


class PositionRestored(BaseEvent):
    event_type = "organization.position.restored"


class PositionDeleted(BaseEvent):
    event_type = "organization.position.deleted"
