from apps.core.events import DomainEvent


class PermissionCreated(DomainEvent):
    event_type = "organization.permission.created"


class PermissionUpdated(DomainEvent):
    event_type = "organization.permission.updated"


class PermissionDeleted(DomainEvent):
    event_type = "organization.permission.deleted"


class PermissionGranted(DomainEvent):
    event_type = "organization.permission.granted"


class PermissionRevoked(DomainEvent):
    event_type = "organization.permission.revoked"
