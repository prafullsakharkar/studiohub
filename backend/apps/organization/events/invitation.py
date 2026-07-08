from apps.core.events import DomainEvent


class InvitationCreated(DomainEvent):
    event_type = "organization.invitation.created"


class InvitationUpdated(DomainEvent):
    event_type = "organization.invitation.updated"


class InvitationDeleted(DomainEvent):
    event_type = "organization.invitation.deleted"


class InvitationArchived(DomainEvent):
    event_type = "organization.invitation.archived"


class InvitationActivated(DomainEvent):
    event_type = "organization.invitation.activated"


class InvitationDeactivated(DomainEvent):
    event_type = "organization.invitation.deactivated"


class InvitationRestored(DomainEvent):
    event_type = "organization.invitation.restored"


class InvitationAccepted(DomainEvent):
    event_type = "organization.invitation.accepted"


class InvitationDeclined(DomainEvent):
    event_type = "organization.invitation.declined"


class InvitationCancelled(DomainEvent):
    event_type = "organization.invitation.cancelled"


class InvitationExpired(DomainEvent):
    event_type = "organization.invitation.expired"


class InvitationResent(DomainEvent):
    event_type = "organization.invitation.resent"
