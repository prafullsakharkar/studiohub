from apps.core.events import BaseEvent


class RoleCreated(BaseEvent):
    event_type = "identity.role.created"


class RoleUpdated(BaseEvent):
    event_type = "identity.role.updated"


class RoleArchived(BaseEvent):
    event_type = "identity.role.archived"


class RoleRestored(BaseEvent):
    event_type = "identity.role.restored"


class RoleDeleted(BaseEvent):
    event_type = "identity.role.deleted"


class RolePermissionsUpdated(BaseEvent):
    event_type = "identity.role.permissions_updated"
