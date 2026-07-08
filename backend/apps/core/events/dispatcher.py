"""
Event dispatcher.
"""

from __future__ import annotations

from apps.core.events.base import DomainEvent
from apps.core.events.registry import EventRegistry


class EventDispatcher:

    def __init__(
        self,
        registry: EventRegistry,
    ) -> None:
        self.registry = registry

    def dispatch(
        self,
        event: DomainEvent,
    ) -> None:

        for handler_cls in self.registry.handlers_for(event):
            handler_cls().handle(event)
