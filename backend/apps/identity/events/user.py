from apps.core.events import DomainEvent


class UserCreated(DomainEvent):
    event_type = "identity.user.created"


class UserUpdated(DomainEvent):
    event_type = "identity.user.updated"


class UserArchived(DomainEvent):
    event_type = "identity.user.archived"


class UserActivated(DomainEvent):
    event_type = "identity.user.activated"


class UserDeactivated(DomainEvent):
    event_type = "identity.user.deactivated"


class UserRestored(DomainEvent):
    event_type = "identity.user.restored"


class UserDeleted(DomainEvent):
    event_type = "identity.user.deleted"
