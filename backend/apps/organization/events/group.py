from apps.core.events import DomainEvent


class GroupCreated(DomainEvent):
    event_type = "organization.group.created"


class GroupUpdated(DomainEvent):
    event_type = "organization.group.updated"


class GroupDeleted(DomainEvent):
    event_type = "organization.group.deleted"


class GroupMemberAdded(DomainEvent):
    event_type = "organization.group.member_added"


class GroupMemberRemoved(DomainEvent):
    event_type = "organization.group.member_removed"


class GroupRoleAdded(DomainEvent):
    event_type = "organization.group.role_added"


class GroupRoleRemoved(DomainEvent):
    event_type = "organization.group.role_removed"
