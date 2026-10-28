"""
Audit event subscriptions. ``register_events`` is called by core event autodiscovery and subscribes
the handler that records attachment activity (TPN review TM-012).
"""

from __future__ import annotations


def register_events() -> None:
    from apps.audit.events.handlers import AttachmentAuditHandler
    from apps.core.events.attachment_events import ATTACHMENT_EVENTS
    from apps.core.events.bus import default_event_bus

    for event in ATTACHMENT_EVENTS:
        default_event_bus.subscribe(event, AttachmentAuditHandler)
