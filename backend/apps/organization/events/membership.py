from apps.core.events import BaseEvent


class MembershipCreated(BaseEvent):
    event_type = "organization.membership.created"


class MembershipUpdated(BaseEvent):
    event_type = "organization.membership.updated"


class MembershipDeleted(BaseEvent):
    event_type = "organization.membership.deleted"


class MembershipArchived(BaseEvent):
    event_type = "organization.membership.archived"


class MembershipActivated(BaseEvent):
    event_type = "organization.membership.activated"


class MembershipDeactivated(BaseEvent):
    event_type = "organization.membership.deactivated"


class MembershipReactivated(BaseEvent):
    event_type = "organization.membership.reactivated"


class MembershipRestored(BaseEvent):
    event_type = "organization.membership.restored"


class MembershipAccepted(BaseEvent):
    event_type = "organization.membership.accepted"


class MembershipDeclined(BaseEvent):
    event_type = "organization.membership.declined"


class MembershipSuspended(BaseEvent):
    event_type = "organization.membership.suspended"


class MembershipExpired(BaseEvent):
    event_type = "organization.membership.expired"
