"""
Production domain events.

Published by the services and dispatched after commit by the core event bus.
Payloads carry ids and status names only.
"""

from __future__ import annotations

from apps.core.events.base import DomainEvent


class StatusChanged(DomainEvent):
    """
    An entity moved to another status.

    Payload: ``entity_type``, ``entity_id``, ``project_id``, ``from_status``,
    ``to_status``, ``actor_id``, ``reason``.
    """
