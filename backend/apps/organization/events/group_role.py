from apps.core.events import DomainEvent


class GroupRoleAdded(DomainEvent):
    event_type = "organization.group_role.added"


class GroupRoleRemoved(DomainEvent):
    event_type = "organization.group_role.removed"


class GroupRoleUpdated(DomainEvent):
    event_type = "organization.group_role.updated"
