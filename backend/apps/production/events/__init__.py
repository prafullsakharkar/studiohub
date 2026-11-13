"""
Production event wiring. ``register_events`` is called by core event autodiscovery.

``StatusChanged`` drives the approval roll-up (review pipeline RP-3, C-RP-15).
"""

from __future__ import annotations


def register_events() -> None:
    from apps.core.events.bus import default_event_bus
    from apps.production.events.handlers import ApprovalRollupHandler
    from apps.production.events.status import StatusChanged

    default_event_bus.subscribe(StatusChanged, ApprovalRollupHandler)
