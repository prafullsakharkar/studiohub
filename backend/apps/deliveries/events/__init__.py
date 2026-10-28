"""
Deliveries event wiring. ``register_events`` is called by core event autodiscovery and subscribes
the handlers below; Deliveries publishes no events of its own yet (notifications are LATER, Q5).
"""

from __future__ import annotations


def register_events() -> None:
    from apps.core.events.bus import default_event_bus
    from apps.deliveries.events.handlers import RevokedFileHandler
    from apps.publishing.events import PublishedFileRevoked

    default_event_bus.subscribe(PublishedFileRevoked, RevokedFileHandler)
