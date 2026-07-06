from apps.core.events import BaseEvent


class UserRoleCreated(BaseEvent):
    event_type = "identity.user_role.created"


class UserRoleDeleted(BaseEvent):
    event_type = "identity.user_role.deleted"
