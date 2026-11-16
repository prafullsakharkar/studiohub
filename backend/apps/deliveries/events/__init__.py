"""
Deliveries event wiring. ``register_events`` is called by core event autodiscovery and subscribes
the handlers below. Deliveries publishes ``DeliveryStatusChanged`` (review-pipeline RP-13,
C-RP-35); the notifications app subscribes to it, never the other way round.
"""

from __future__ import annotations

from apps.deliveries.events.status import DeliveryStatusChanged

__all__ = ["DeliveryStatusChanged", "register_events"]


def register_events() -> None:
    from apps.core.events.bus import default_event_bus
    from apps.deliveries.events.handlers import RevokedFileHandler
    from apps.publishing.events import PublishedFileRevoked

    default_event_bus.subscribe(PublishedFileRevoked, RevokedFileHandler)
