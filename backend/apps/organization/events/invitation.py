from apps.core.events import BaseEvent


class InvitationCreated(BaseEvent):
    event_type = "organization.invitation.created"


class InvitationUpdated(BaseEvent):
    event_type = "organization.invitation.updated"


class InvitationDeleted(BaseEvent):
    event_type = "organization.invitation.deleted"


class InvitationArchived(BaseEvent):
    event_type = "organization.invitation.archived"


class InvitationActivated(BaseEvent):
    event_type = "organization.invitation.activated"


class InvitationDeactivated(BaseEvent):
    event_type = "organization.invitation.deactivated"


class InvitationRestored(BaseEvent):
    event_type = "organization.invitation.restored"


class InvitationAccepted(BaseEvent):
    event_type = "organization.invitation.accepted"


class InvitationDeclined(BaseEvent):
    event_type = "organization.invitation.declined"


class InvitationCancelled(BaseEvent):
    event_type = "organization.invitation.cancelled"


class InvitationExpired(BaseEvent):
    event_type = "organization.invitation.expired"


class InvitationResent(BaseEvent):
    event_type = "organization.invitation.resent"
