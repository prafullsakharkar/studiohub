from apps.core.events import DomainEvent


class GroupMemberCreated(DomainEvent):
    event_type = "identity.group_member.created"


class GroupMemberUpdated(DomainEvent):
    event_type = "identity.group_member.updated"


class GroupMemberArchived(DomainEvent):
    event_type = "identity.group_member.archived"


class GroupMemberActivated(DomainEvent):
    event_type = "identity.group_member.activated"


class GroupMemberDeactivated(DomainEvent):
    event_type = "identity.group_member.deactivated"


class GroupMemberRestored(DomainEvent):
    event_type = "identity.group_member.restored"


class GroupMemberDeleted(DomainEvent):
    event_type = "identity.group_member.deleted"
