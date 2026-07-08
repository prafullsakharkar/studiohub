from apps.core.events import DomainEvent


class GroupRoleCreated(DomainEvent):
    event_type = "identity.group_role.created"


class GroupRoleDeleted(DomainEvent):
    event_type = "identity.group_role.deleted"
