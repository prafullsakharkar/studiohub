from apps.core.events import BaseEvent


class InvitationCreated(BaseEvent):
    event_type = "identity.invitation.created"


class InvitationAccepted(BaseEvent):
    event_type = "identity.invitation.accepted"


class InvitationDeclined(BaseEvent):
    event_type = "identity.invitation.declined"


class InvitationExpired(BaseEvent):
    event_type = "identity.invitation.expired"


class InvitationCancelled(BaseEvent):
    event_type = "identity.invitation.cancelled"


class InvitationResent(BaseEvent):
    event_type = "identity.invitation.resent"
