"""
Masterdata domain event subscriptions.

``register_events`` is called by core event autodiscovery. It subscribes the
audit handler to every record event (docs/masterdata/CONTRACTS.md §7).
"""

from __future__ import annotations


def register_events() -> None:
    from apps.core.events.bus import default_event_bus
    from apps.masterdata.events.handlers import MasterdataAuditHandler
    from apps.masterdata.events.records import RECORD_EVENTS

    for event in RECORD_EVENTS:
        default_event_bus.subscribe(event, MasterdataAuditHandler)
