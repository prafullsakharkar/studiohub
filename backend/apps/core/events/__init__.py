"""
Core events.

Provides base event classes and infrastructure for domain applications.
"""

from __future__ import annotations

from apps.core.events.base import BaseCreated, BaseDeleted, BaseUpdated, DomainEvent, Event
from apps.core.events.bus import EventBus, default_event_bus

__all__ = [
    "BaseCreated",
    "BaseDeleted",
    "BaseUpdated",
    "DomainEvent",
    "EventBus",
]


def publish(event):
    """Publish an event to the event bus."""
    default_event_bus.publish(event)
