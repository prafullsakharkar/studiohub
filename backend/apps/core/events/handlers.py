"""
Base event handler.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from apps.core.events.base import DomainEvent


class DomainEventHandler(ABC):
    """
    Base class for all event handlers.
    """

    @abstractmethod
    def handle(self, event: DomainEvent) -> None:
        """
        Handle a domain event.
        """
        raise NotImplementedError
