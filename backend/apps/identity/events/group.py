from apps.core.events import BaseEvent


class GroupCreated(BaseEvent):
    event_type = "identity.group.created"


class GroupUpdated(BaseEvent):
    event_type = "identity.group.updated"


class GroupArchived(BaseEvent):
    event_type = "identity.group.archived"


class GroupActivated(BaseEvent):
    event_type = "identity.group.activated"


class GroupDeactivated(BaseEvent):
    event_type = "identity.group.deactivated"


class GroupRestored(BaseEvent):
    event_type = "identity.group.restored"


class GroupDeleted(BaseEvent):
    event_type = "identity.group.deleted"


class GroupUserAdded(BaseEvent):
    event_type = "identity.group.user_added"


class GroupUserRemoved(BaseEvent):
    event_type = "identity.group.user_removed"
