"""
Base domain event.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4

from apps.core.events.constants import (
    EventSource,
    EventVersion,
)


@dataclass(frozen=True, slots=True, kw_only=True)
class BaseEvent:
    """
    Base class for all domain events.
    """

    event_id: UUID = field(default_factory=uuid4)

    occurred_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    version: int = EventVersion.V1

    source: str = EventSource.SERVICE

    correlation_id: UUID | None = None

    causation_id: UUID | None = None
