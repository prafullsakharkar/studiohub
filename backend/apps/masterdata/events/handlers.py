"""Audit handler: one ``audit.AuditLog`` row per masterdata event."""

from __future__ import annotations

from apps.core.events.base import DomainEvent
from apps.core.events.handlers import DomainEventHandler
from apps.core.logging.logger import get_logger
from apps.masterdata.events import records

logger = get_logger("masterdata")

_ACTIONS: dict[type[DomainEvent], str] = {
    records.MasterdataRecordCreated: "create",
    records.MasterdataRecordUpdated: "update",
    records.MasterdataRecordArchived: "update",
    records.MasterdataRecordRestored: "update",
    records.MasterdataRecordDeleted: "delete",
    records.MasterdataRecordHardDeleted: "delete",
}
_VERBS: dict[type[DomainEvent], str] = {
    records.MasterdataRecordCreated: "created",
    records.MasterdataRecordUpdated: "updated",
    records.MasterdataRecordArchived: "archived",
    records.MasterdataRecordRestored: "restored",
    records.MasterdataRecordDeleted: "deleted",
    records.MasterdataRecordHardDeleted: "permanently deleted",
}


class MasterdataAuditHandler(DomainEventHandler):
    def handle(self, event) -> None:
        # An audit failure must never undo or fail the committed write.
        try:
            from apps.audit.models import AuditLog

            payload = event.payload
            kind = type(event)
            metadata = {"event": kind.__name__, "code": payload.get("code")}
            for key in ("fields", "changed", "cascade"):
                if payload.get(key):
                    metadata[key] = payload[key]
            AuditLog.objects.create(
                action=_ACTIONS[kind],
                severity=AuditLog.SEVERITY_WARNING
                if kind is records.MasterdataRecordHardDeleted
                else AuditLog.SEVERITY_INFO,
                target_type=AuditLog.TARGET_MASTERDATA,
                target_id=str(payload.get("id", "")),
                target_name=str(payload.get("name") or payload.get("code") or "")[:255],
                description=f"{payload.get('model')} {_VERBS[kind]}",
                actor_id=payload.get("actor_id"),
                metadata=metadata,
            )
        except Exception:  # noqa: BLE001
            logger.exception("masterdata_audit_failed", event_name=type(event).__name__)
