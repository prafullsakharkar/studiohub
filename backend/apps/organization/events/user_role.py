from apps.core.events import DomainEvent


class UserRoleAssigned(DomainEvent):
    event_type = "organization.user_role.assigned"


class UserRoleRevoked(DomainEvent):
    event_type = "organization.user_role.revoked"
