from apps.core.events import DomainEvent


class RoleCreated(DomainEvent):
    event_type = "identity.role.created"


class RoleUpdated(DomainEvent):
    event_type = "identity.role.updated"


class RoleArchived(DomainEvent):
    event_type = "identity.role.archived"


class RoleRestored(DomainEvent):
    event_type = "identity.role.restored"


class RoleDeleted(DomainEvent):
    event_type = "identity.role.deleted"


class RolePermissionsUpdated(DomainEvent):
    event_type = "identity.role.permissions_updated"
