from apps.core.events import DomainEvent


class RoleCreated(DomainEvent):
    event_type = "organization.role.created"


class RoleUpdated(DomainEvent):
    event_type = "organization.role.updated"


class RoleDeleted(DomainEvent):
    event_type = "organization.role.deleted"


class RoleAssigned(DomainEvent):
    event_type = "organization.role.assigned"


class RoleRevoked(DomainEvent):
    event_type = "organization.role.revoked"


class RolePermissionGranted(DomainEvent):
    event_type = "organization.role.permission_granted"


class RolePermissionRevoked(DomainEvent):
    event_type = "organization.role.permission_revoked"
