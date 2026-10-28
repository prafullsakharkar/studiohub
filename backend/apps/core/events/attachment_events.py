"""
Attachment audit events (TPN review TM-012).

Published by the attachment API and the signed download view; the Audit app subscribes and writes one
``AuditLog`` row per event (``apps/audit/events``). Payload keys: ``id``, ``name``, ``file_size``,
``mime_type``, ``actor_id``, ``ip`` and, for updates, ``fields``. Never the file content or the link.

The older dataclasses in ``attachment.py`` are not used by anything.
"""

from __future__ import annotations

from typing import Any

from apps.core.events.base import DomainEvent


class AttachmentUploaded(DomainEvent):
    """A file was uploaded."""


class AttachmentDownloaded(DomainEvent):
    """A file left the system through a signed download link."""


class AttachmentChanged(DomainEvent):
    """An attachment's metadata was changed."""


class AttachmentRemoved(DomainEvent):
    """An attachment was deleted."""


ATTACHMENT_EVENTS = (
    AttachmentUploaded,
    AttachmentDownloaded,
    AttachmentChanged,
    AttachmentRemoved,
)


def attachment_payload(attachment: Any, *, actor_id: Any, ip: str, **extra: Any) -> dict[str, Any]:
    return {
        "id": str(attachment.pk),
        "name": attachment.name,
        "file_size": attachment.file_size,
        "mime_type": attachment.mime_type,
        "actor_id": str(actor_id) if actor_id else None,
        "ip": ip,
        **extra,
    }
