from apps.core.events import DomainEvent


class GroupCreated(DomainEvent):
    event_type = "identity.group.created"


class GroupUpdated(DomainEvent):
    event_type = "identity.group.updated"


class GroupArchived(DomainEvent):
    event_type = "identity.group.archived"


class GroupActivated(DomainEvent):
    event_type = "identity.group.activated"


class GroupDeactivated(DomainEvent):
    event_type = "identity.group.deactivated"


class GroupRestored(DomainEvent):
    event_type = "identity.group.restored"


class GroupDeleted(DomainEvent):
    event_type = "identity.group.deleted"


class GroupUserAdded(DomainEvent):
    event_type = "identity.group.user_added"


class GroupUserRemoved(DomainEvent):
    event_type = "identity.group.user_removed"
