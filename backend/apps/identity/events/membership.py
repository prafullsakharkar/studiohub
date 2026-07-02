from apps.core.events import BaseEvent


class MembershipCreated(BaseEvent):
    event_type = "identity.membership.created"


class MembershipUpdated(BaseEvent):
    event_type = "identity.membership.updated"


class MembershipArchived(BaseEvent):
    event_type = "identity.membership.archived"


class MembershipRestored(BaseEvent):
    event_type = "identity.membership.restored"


class MembershipDeleted(BaseEvent):
    event_type = "identity.membership.deleted"


class MembershipActivated(BaseEvent):
    event_type = "identity.membership.activated"


class MembershipSuspended(BaseEvent):
    event_type = "identity.membership.suspended"
