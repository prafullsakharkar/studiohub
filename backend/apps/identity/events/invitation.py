from apps.core.events import DomainEvent


class InvitationCreated(DomainEvent):
    event_type = "identity.invitation.created"


class InvitationAccepted(DomainEvent):
    event_type = "identity.invitation.accepted"


class InvitationDeclined(DomainEvent):
    event_type = "identity.invitation.declined"


class InvitationExpired(DomainEvent):
    event_type = "identity.invitation.expired"


class InvitationCancelled(DomainEvent):
    event_type = "identity.invitation.cancelled"


class InvitationResent(DomainEvent):
    event_type = "identity.invitation.resent"
