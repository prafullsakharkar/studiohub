from apps.core.events import DomainEvent


class MembershipCreated(DomainEvent):
    event_type = "identity.membership.created"


class MembershipUpdated(DomainEvent):
    event_type = "identity.membership.updated"


class MembershipArchived(DomainEvent):
    event_type = "identity.membership.archived"


class MembershipRestored(DomainEvent):
    event_type = "identity.membership.restored"


class MembershipDeleted(DomainEvent):
    event_type = "identity.membership.deleted"


class MembershipActivated(DomainEvent):
    event_type = "identity.membership.activated"


class MembershipSuspended(DomainEvent):
    event_type = "identity.membership.suspended"
