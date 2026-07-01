"""
Event bus.
"""

from __future__ import annotations

from apps.core.events.dispatcher import EventDispatcher
from apps.core.events.registry import EventRegistry


class EventBus:

    def __init__(self):

        self.registry = EventRegistry()

        self.dispatcher = EventDispatcher(
            self.registry,
        )

    def publish(self, event):

        self.dispatcher.dispatch(event)

    def subscribe(
        self,
        event,
        handler,
    ):
        self.registry.register(
            event,
            handler,
        )


default_event_bus = EventBus()
