from apps.core.events import BaseEvent


class GroupRoleCreated(BaseEvent):
    event_type = "identity.group_role.created"


class GroupRoleDeleted(BaseEvent):
    event_type = "identity.group_role.deleted"
