"""
Notification wiring (docs/review-pipeline RP-6, C-RP-24). ``register_events`` is called by core
event autodiscovery; production publishes the events and never imports this app.
"""

from __future__ import annotations


def register_events() -> None:
    from apps.core.events.bus import default_event_bus
    from apps.notifications.events import handlers
    from apps.production.events.notes import (
        NoteCreated,
        NoteMentioned,
        NoteReplied,
        NoteStatusChanged,
    )
    from apps.production.events.review_media import ReviewMediaFinished
    from apps.production.events.status import StatusChanged
    from apps.production.events.tasks import TaskAssigned

    default_event_bus.subscribe(NoteCreated, handlers.NoteCreatedHandler)
    default_event_bus.subscribe(NoteReplied, handlers.NoteRepliedHandler)
    default_event_bus.subscribe(NoteStatusChanged, handlers.NoteStatusHandler)
    default_event_bus.subscribe(NoteMentioned, handlers.NoteMentionedHandler)
    default_event_bus.subscribe(TaskAssigned, handlers.TaskAssignedHandler)
    default_event_bus.subscribe(StatusChanged, handlers.StatusChangedHandler)
    default_event_bus.subscribe(ReviewMediaFinished, handlers.ReviewMediaFinishedHandler)
