"""
Attachment events.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class AttachmentCreated:
    """Event triggered when an attachment is created."""

    attachment_uuid: str
    attachment_name: str
    organization_uuid: str


@dataclass
class AttachmentUpdated:
    """Event triggered when an attachment is updated."""

    attachment_uuid: str
    attachment_name: str
    organization_uuid: str


@dataclass
class AttachmentDeleted:
    """Event triggered when an attachment is deleted."""

    attachment_uuid: str
    attachment_name: str
    organization_uuid: str


__all__ = ["AttachmentCreated", "AttachmentUpdated", "AttachmentDeleted", "AttachmentEvent"]

# Alias for backward compatibility
AttachmentEvent = AttachmentCreated
