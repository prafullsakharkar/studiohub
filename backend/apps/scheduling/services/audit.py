"""
Audit rows for scheduling, under the ``scheduling`` target (docs/delivery-pipeline Q23).

Descriptions and metadata carry ids, codes, dates, statuses and counts: never the text of a leave
reason, a rejection reason, a booking note or a rate (SEC-SCH-05). The one free text recorded is the
reason a person gives for deciding their own leave under ``schedule.sod.override``, which is an
explanation for the audit trail and not a leave reason.
"""

from __future__ import annotations

from typing import Any

from apps.audit.models import AuditLog


def record(
    *,
    actor: Any,
    action: str,
    target_id: Any,
    target_name: str,
    description: str,
    metadata: dict[str, Any] | None = None,
    severity: str | None = None,
) -> None:
    extra: dict[str, Any] = {"severity": severity} if severity else {}
    AuditLog.objects.create(
        action=action,
        target_type=AuditLog.TARGET_SCHEDULING,
        target_id=str(target_id),
        target_name=target_name[:255],
        description=description,
        actor_id=getattr(actor, "pk", None),
        metadata=metadata or {},
        **extra,
    )
