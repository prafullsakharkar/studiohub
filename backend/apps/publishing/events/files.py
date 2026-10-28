"""
Publishing domain events.

Published by the services and dispatched after commit by the core event bus. Payloads carry
ids only: never a path, a checksum or the text of a reason.
"""

from __future__ import annotations

from apps.core.events.base import DomainEvent


class PublishedFileRevoked(DomainEvent):
    """
    A registered file was revoked.

    Payload: ``file_id``, ``version_id``, ``project_id``, ``actor_id``, ``reason_present``.
    """
