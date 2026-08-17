"""
Base domain event.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

from apps.core.events.constants import (
    EventSource,
    EventVersion,
)

# Python 3.9 compatibility - kw_only=True was added in Python 3.10
# and UTC was added in Python 3.11
try:
    from datetime import UTC
except ImportError:
    UTC = timezone.utc


@dataclass(frozen=True)
class DomainEvent:
    """
    Base class for all domain events.

    Subclasses SHOULD declare a stable ``event_type`` string (e.g.
    ``event_type = "identity.user.created"``). When omitted, the event type
    defaults to the fully-qualified class name so every event remains
    addressable.
    """

    event_id: UUID = field(default_factory=uuid4)

    occurred_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    version: int = EventVersion.V1

    source: str = EventSource.SERVICE

    @property
    def event_type(self) -> str:
        """
        Stable identifier for this event.

        Uses the subclass ``event_type`` class attribute when defined,
        otherwise falls back to the class name.
        """
        declared = type(self).__dict__.get("event_type")
        if isinstance(declared, str):
            return declared
        return type(self).__name__
