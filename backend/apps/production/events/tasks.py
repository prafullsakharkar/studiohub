"""
Task events (docs/review-pipeline RP-6, C-RP-24).

Published by ``TaskService`` and dispatched after commit by the core event bus. Payloads carry ids
only. The in-app notifications of RP-6 subscribe.
"""

from __future__ import annotations

from apps.core.events.base import DomainEvent


class TaskAssigned(DomainEvent):
    """
    A task was given an assignee, or a different one.

    Payload: ``task_id``, ``project_id``, ``from_assignee_id`` (or ``None``), ``to_assignee_id``,
    ``actor_id``.
    """
