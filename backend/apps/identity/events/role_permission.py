from apps.core.events import DomainEvent


class RolePermissionCreated(DomainEvent):
    event_type = "identity.role_permission.created"


class RolePermissionDeleted(DomainEvent):
    event_type = "identity.role_permission.deleted"
