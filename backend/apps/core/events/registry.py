"""
Handler registry for domain events.
"""

from __future__ import annotations

from collections import defaultdict

from apps.core.events.base import DomainEvent
from apps.core.events.handlers import DomainEventHandler


class EventRegistry:
    """
    Registry of event handlers.
    """

    def __init__(self) -> None:
        self._handlers: dict[
            type[DomainEvent],
            list[type[DomainEventHandler]],
        ] = defaultdict(list)

    def register(
        self,
        event: type[DomainEvent],
        handler: type[DomainEventHandler],
    ) -> None:
        """
        Register a handler for an event.
        """
        if handler not in self._handlers[event]:
            self._handlers[event].append(handler)

    def unregister(
        self,
        event: type[DomainEvent],
        handler: type[DomainEventHandler],
    ) -> None:
        """
        Remove a handler.
        """
        if handler in self._handlers[event]:
            self._handlers[event].remove(handler)

    def handlers_for(
        self,
        event: DomainEvent,
    ) -> list[type[DomainEventHandler]]:
        """
        Return handlers for an event instance.
        """
        return self._handlers.get(type(event), [])

    def clear(self) -> None:
        """
        Clear all registrations.
        """
        self._handlers.clear()
