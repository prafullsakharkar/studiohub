from apps.core.events import DomainEvent


class GroupMemberAdded(DomainEvent):
    event_type = "organization.group_member.added"


class GroupMemberRemoved(DomainEvent):
    event_type = "organization.group_member.removed"


class GroupMemberUpdated(DomainEvent):
    event_type = "organization.group_member.updated"
