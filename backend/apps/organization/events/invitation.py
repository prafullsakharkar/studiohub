from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.organization.models import Invitation


@dataclass
class InvitationEvent:
    """Base class for invitation events."""

    invitation: Invitation


@dataclass
class InvitationCreatedEvent(InvitationEvent):
    """Event triggered when an invitation is created."""


InvitationCreated = InvitationCreatedEvent


@dataclass
class InvitationSentEvent(InvitationEvent):
    """Event triggered when an invitation is sent."""


@dataclass
class InvitationAcceptedEvent(InvitationEvent):
    """Event triggered when an invitation is accepted."""


@dataclass
class InvitationDeclinedEvent(InvitationEvent):
    """Event triggered when an invitation is declined."""


InvitationDeclined = InvitationDeclinedEvent


@dataclass
class InvitationCancelledEvent(InvitationEvent):
    """Event triggered when an invitation is cancelled."""


InvitationCancelled = InvitationCancelledEvent


@dataclass
class InvitationExpiredEvent(InvitationEvent):
    """Event triggered when an invitation expires."""


@dataclass
class InvitationActivatedEvent(InvitationEvent):
    """Event triggered when an invitation is activated."""


@dataclass
class InvitationDeactivatedEvent(InvitationEvent):
    """Event triggered when an invitation is deactivated."""


InvitationAccepted = InvitationAcceptedEvent
InvitationActivated = InvitationActivatedEvent
InvitationDeactivated = InvitationDeactivatedEvent


@dataclass
class InvitationArchivedEvent(InvitationEvent):
    """Event triggered when an invitation is archived."""


InvitationArchived = InvitationArchivedEvent


@dataclass
class InvitationDeletedEvent(InvitationEvent):
    """Event triggered when an invitation is deleted."""


InvitationDeleted = InvitationDeletedEvent
InvitationExpired = InvitationExpiredEvent


@dataclass
class InvitationResentEvent(InvitationEvent):
    """Event triggered when an invitation is resent."""


InvitationResent = InvitationResentEvent


@dataclass
class InvitationRestoredEvent(InvitationEvent):
    """Event triggered when an invitation is restored."""


InvitationRestored = InvitationRestoredEvent


@dataclass
class InvitationUpdatedEvent(InvitationEvent):
    """Event triggered when an invitation is updated."""


InvitationUpdated = InvitationUpdatedEvent
