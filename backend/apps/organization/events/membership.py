from apps.core.events import DomainEvent


class MembershipCreated(DomainEvent):
    event_type = "organization.membership.created"


class MembershipUpdated(DomainEvent):
    event_type = "organization.membership.updated"


class MembershipDeleted(DomainEvent):
    event_type = "organization.membership.deleted"


class MembershipArchived(DomainEvent):
    event_type = "organization.membership.archived"


class MembershipActivated(DomainEvent):
    event_type = "organization.membership.activated"


class MembershipDeactivated(DomainEvent):
    event_type = "organization.membership.deactivated"


class MembershipReactivated(DomainEvent):
    event_type = "organization.membership.reactivated"


class MembershipRestored(DomainEvent):
    event_type = "organization.membership.restored"


class MembershipAccepted(DomainEvent):
    event_type = "organization.membership.accepted"


class MembershipDeclined(DomainEvent):
    event_type = "organization.membership.declined"


class MembershipSuspended(DomainEvent):
    event_type = "organization.membership.suspended"


class MembershipExpired(DomainEvent):
    event_type = "organization.membership.expired"
