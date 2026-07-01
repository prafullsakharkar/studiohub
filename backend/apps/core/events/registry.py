"""
Handler registry for domain events.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Type

from apps.core.events.base import BaseEvent
from apps.core.events.handlers import BaseEventHandler


class EventRegistry:
    """
    Registry of event handlers.
    """

    def __init__(self) -> None:
        self._handlers: dict[
            Type[BaseEvent],
            list[type[BaseEventHandler]],
        ] = defaultdict(list)

    def register(
        self,
        event: Type[BaseEvent],
        handler: type[BaseEventHandler],
    ) -> None:
        """
        Register a handler for an event.
        """
        if handler not in self._handlers[event]:
            self._handlers[event].append(handler)

    def unregister(
        self,
        event: Type[BaseEvent],
        handler: type[BaseEventHandler],
    ) -> None:
        """
        Remove a handler.
        """
        if handler in self._handlers[event]:
            self._handlers[event].remove(handler)

    def handlers_for(
        self,
        event: BaseEvent,
    ) -> list[type[BaseEventHandler]]:
        """
        Return handlers for an event instance.
        """
        return self._handlers.get(type(event), [])

    def clear(self) -> None:
        """
        Clear all registrations.
        """
        self._handlers.clear()
