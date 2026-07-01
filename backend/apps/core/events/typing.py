"""
Typing helpers for the event framework.
"""

from __future__ import annotations

from typing import Protocol

from apps.core.events.base import BaseEvent


class EventHandlerProtocol(Protocol):
    """
    Protocol for event handlers.
    """

    def handle(self, event: BaseEvent) -> None: ...
