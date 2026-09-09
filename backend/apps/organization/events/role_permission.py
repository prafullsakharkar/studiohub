from apps.core.events import DomainEvent


class RolePermissionGranted(DomainEvent):
    event_type = "organization.role_permission.granted"


class RolePermissionRevoked(DomainEvent):
    event_type = "organization.role_permission.revoked"


class RolePermissionUpdated(DomainEvent):
    event_type = "organization.role_permission.updated"
