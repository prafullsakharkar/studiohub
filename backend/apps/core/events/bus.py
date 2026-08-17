"""
Event bus.
"""

from __future__ import annotations

from apps.core.events.base import DomainEvent
from apps.core.events.dispatcher import EventDispatcher
from apps.core.events.registry import EventRegistry


class EventBus:
    """
    Central event bus.

    ``publish`` and ``subscribe`` are classmethods that operate on the
    module-level ``default_event_bus`` singleton. This keeps the public API
    ergonomic (``EventBus.publish(event)``) while retaining a single shared
    registry and dispatcher.
    """

    def __init__(self) -> None:
        self.registry = EventRegistry()
        self.dispatcher = EventDispatcher(self.registry)

    @classmethod
    def publish(
        cls,
        event: DomainEvent,
        *,
        on_commit: bool = False,
    ) -> None:
        """
        Publish a domain event to all registered handlers.

        By default handlers run immediately. Pass ``on_commit=True`` to defer
        dispatch until the surrounding database transaction commits, which
        avoids publishing events for transactions that later roll back.
        """
        default_event_bus.dispatcher.dispatch(
            event,
            on_commit=on_commit,
        )

    @classmethod
    def subscribe(
        cls,
        event,
        handler,
    ) -> None:
        """
        Register a handler for an event type.
        """
        default_event_bus.registry.register(
            event,
            handler,
        )


default_event_bus = EventBus()
