from apps.core.events import DomainEvent


class UserRoleCreated(DomainEvent):
    event_type = "identity.user_role.created"


class UserRoleDeleted(DomainEvent):
    event_type = "identity.user_role.deleted"
