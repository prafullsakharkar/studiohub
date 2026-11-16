"""
Scheduling domain events (docs/review-pipeline RP-13, C-RP-35).

Published by the services and dispatched after commit by the core event bus. Payloads carry ids
only: never a milestone's notes. Scheduling subscribes to nothing.
"""

from __future__ import annotations

from apps.core.events.base import DomainEvent


class MilestoneCompleted(DomainEvent):
    """
    A milestone was completed.

    Payload: ``milestone_id``, ``project_id``, ``actor_id`` (``None`` when nobody signed in did it).
    """


__all__ = ["MilestoneCompleted"]
