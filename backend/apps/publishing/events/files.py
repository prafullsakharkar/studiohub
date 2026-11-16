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


class PublishJobFinished(DomainEvent):
    """
    A publish job ended Exported or Failed (review-pipeline RP-13, C-RP-35).

    Payload: ``job_id``, ``project_id`` (``None`` for an old job that names no project),
    ``version_id`` (``None`` for a job not linked to a version), ``status`` (``Exported`` or
    ``Failed``) and ``actor_id``. Never the error message.
    """
