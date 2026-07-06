from apps.core.events import BaseEvent


class RolePermissionCreated(BaseEvent):
    event_type = "identity.role_permission.created"


class RolePermissionDeleted(BaseEvent):
    event_type = "identity.role_permission.deleted"
