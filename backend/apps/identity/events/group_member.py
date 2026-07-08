from apps.core.events import DomainEvent


class GroupMemberCreated(DomainEvent):
    event_type = "identity.group_member.created"


class GroupMemberUpdated(DomainEvent):
    event_type = "identity.group_member.updated"


class GroupMemberDeleted(DomainEvent):
    event_type = "identity.group_member.deleted"


class GroupMemberRestored(DomainEvent):
    event_type = "identity.group_member.restored"
