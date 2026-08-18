"""
Base events for core models.
"""

from __future__ import annotations

from dataclasses import dataclass


class DomainEvent:
    """
    Base class for domain events.

    Services publish events with ``**kwargs`` payloads (e.g. ``instance``,
    ``user``). The payload is retained on ``.payload`` for handlers that
    need it; subclasses remain free to declare their own dataclass fields.
    """

    def __init__(self, **kwargs):
        object.__setattr__(
            self,
            "payload",
            kwargs,
        )

    @classmethod
    def dispatch(cls, **kwargs):
        """
        Publish an event to the default event bus.

        Subclasses may override this to publish through a specific bus.
        """
        from apps.core.events.bus import default_event_bus

        default_event_bus.publish(
            cls(**kwargs),
        )


@dataclass(frozen=True)
class BaseCreated:
    """Event triggered when a base entity is created."""

    entity_uuid: str
    entity_name: str
    organization_uuid: str


@dataclass(frozen=True)
class BaseUpdated:
    """Event triggered when a base entity is updated."""

    entity_uuid: str
    entity_name: str
    organization_uuid: str


@dataclass(frozen=True)
class BaseDeleted:
    """Event triggered when a base entity is deleted."""

    entity_uuid: str
    entity_name: str
    organization_uuid: str


__all__ = ["BaseCreated", "BaseUpdated", "BaseDeleted", "DomainEvent", "Event"]


class Event:
    """Base class for events."""

    event_name: str = ""

    @property
    def event_type(self) -> str:
        """Return the event type."""
        return self.event_name


@dataclass(frozen=True)
class BaseEvent(DomainEvent):
    """Base event for core entities."""

    pass


@dataclass(frozen=True)
class AttachmentEvent(BaseEvent):
    """Event for attachment operations."""

    attachment_uuid: str
    attachment_name: str
    organization_uuid: str


@dataclass(frozen=True)
class TagEvent(BaseEvent):
    """Event for tag operations."""

    tag_uuid: str
    tag_name: str
    organization_uuid: str
