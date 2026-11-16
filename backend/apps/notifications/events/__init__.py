"""
Notification wiring (docs/review-pipeline RP-6, C-RP-24; RP-13, C-RP-35). ``register_events`` is
called by core event autodiscovery; production, deliveries, publishing and scheduling publish the
events and never import this app.
"""

from __future__ import annotations


def register_events() -> None:
    from apps.core.events.bus import default_event_bus
    from apps.deliveries.events import DeliveryStatusChanged
    from apps.notifications.events import handlers
    from apps.production.events.notes import (
        NoteCreated,
        NoteMentioned,
        NoteReplied,
        NoteStatusChanged,
    )
    from apps.production.events.review_media import ReviewMediaFinished
    from apps.production.events.reviews import (
        ReviewCommentAdded,
        ReviewDecided,
        ReviewParticipantAdded,
        ReviewParticipantVerdict,
    )
    from apps.production.events.status import StatusChanged
    from apps.production.events.tasks import TaskAssigned
    from apps.publishing.events import PublishedFileRevoked, PublishJobFinished
    from apps.scheduling.events import MilestoneCompleted

    default_event_bus.subscribe(NoteCreated, handlers.NoteCreatedHandler)
    default_event_bus.subscribe(NoteReplied, handlers.NoteRepliedHandler)
    default_event_bus.subscribe(NoteStatusChanged, handlers.NoteStatusHandler)
    default_event_bus.subscribe(NoteMentioned, handlers.NoteMentionedHandler)
    default_event_bus.subscribe(TaskAssigned, handlers.TaskAssignedHandler)
    default_event_bus.subscribe(StatusChanged, handlers.StatusChangedHandler)
    default_event_bus.subscribe(ReviewMediaFinished, handlers.ReviewMediaFinishedHandler)
    # RP-11 (C-RP-28): review decisions told through a verdict, invitations, verdicts, comments
    default_event_bus.subscribe(ReviewDecided, handlers.ReviewDecidedHandler)
    default_event_bus.subscribe(ReviewParticipantAdded, handlers.ReviewParticipantAddedHandler)
    default_event_bus.subscribe(ReviewParticipantVerdict, handlers.ReviewParticipantVerdictHandler)
    default_event_bus.subscribe(ReviewCommentAdded, handlers.ReviewCommentAddedHandler)
    # RP-13 (C-RP-35): deliveries, publishing, milestones
    default_event_bus.subscribe(DeliveryStatusChanged, handlers.DeliveryStatusChangedHandler)
    default_event_bus.subscribe(PublishJobFinished, handlers.PublishJobFinishedHandler)
    default_event_bus.subscribe(PublishedFileRevoked, handlers.PublishedFileRevokedHandler)
    default_event_bus.subscribe(MilestoneCompleted, handlers.MilestoneCompletedHandler)
