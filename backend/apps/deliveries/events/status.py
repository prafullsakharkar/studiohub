"""
Deliveries domain events (docs/review-pipeline RP-13, C-RP-35).

Published by ``services.transitions.move`` and dispatched after commit by the core event bus.
Payloads carry ids and status names only: never a reason, a passcode or the client's notes.
"""

from __future__ import annotations

from apps.core.events.base import DomainEvent


class DeliveryStatusChanged(DomainEvent):
    """
    A delivery moved from one status to another.

    Payload: ``delivery_id``, ``project_id`` (``None`` for an old delivery that names no project),
    ``from_status``, ``to_status``, ``actor_id`` (``None`` for a move the platform made),
    ``system`` (the platform made it: a revoked file), ``override_kind`` (``""``, ``"status"``,
    ``"system"`` or ``"self_approval"``) and ``client_status`` (the client's answer the move
    recorded, ``Approved`` or ``Rejected``; ``""`` for any other move).
    """
