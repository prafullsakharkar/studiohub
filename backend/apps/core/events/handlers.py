"""
Base event handler.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from apps.core.events.base import BaseEvent


class BaseEventHandler(ABC):
    """
    Base class for all event handlers.
    """

    @abstractmethod
    def handle(self, event: BaseEvent) -> None:
        """
        Handle a domain event.
        """
        raise NotImplementedError
