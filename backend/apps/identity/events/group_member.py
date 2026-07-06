from apps.core.events import BaseEvent


class GroupMemberCreated(BaseEvent):
    event_type = "identity.group_member.created"


class GroupMemberUpdated(BaseEvent):
    event_type = "identity.group_member.updated"


class GroupMemberDeleted(BaseEvent):
    event_type = "identity.group_member.deleted"


class GroupMemberRestored(BaseEvent):
    event_type = "identity.group_member.restored"
