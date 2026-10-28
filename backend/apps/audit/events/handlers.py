"""Audit handler: one ``AuditLog`` row per attachment event."""

from __future__ import annotations

from apps.core.events.attachment_events import (
    AttachmentChanged,
    AttachmentDownloaded,
    AttachmentRemoved,
    AttachmentUploaded,
)
from apps.core.events.base import DomainEvent
from apps.core.events.handlers import DomainEventHandler
from apps.core.logging.logger import get_logger

logger = get_logger("audit")

# event -> (AuditLog action, past-tense verb)
_KINDS: dict[type[DomainEvent], tuple[str, str]] = {
    AttachmentUploaded: ("create", "uploaded"),
    AttachmentDownloaded: ("export", "downloaded"),
    AttachmentChanged: ("update", "updated"),
    AttachmentRemoved: ("delete", "deleted"),
}


class AttachmentAuditHandler(DomainEventHandler):
    def handle(self, event) -> None:
        # An audit failure must never undo or fail the request that was audited.
        try:
            from apps.audit.models import AuditLog

            payload = event.payload
            action, verb = _KINDS[type(event)]
            metadata = {
                "event": type(event).__name__,
                "file_size": payload.get("file_size"),
                "mime_type": payload.get("mime_type"),
                "ip": payload.get("ip"),
            }
            if payload.get("fields"):
                metadata["fields"] = payload["fields"]

            AuditLog.objects.create(
                action=action,
                severity=AuditLog.SEVERITY_INFO,
                target_type=AuditLog.TARGET_ATTACHMENT,
                target_id=str(payload.get("id", "")),
                target_name=str(payload.get("name") or "")[:255],
                description=f"Attachment {verb}",
                actor_id=payload.get("actor_id"),
                metadata=metadata,
            )
        except Exception:  # noqa: BLE001
            logger.exception("attachment_audit_failed", event_name=type(event).__name__)
