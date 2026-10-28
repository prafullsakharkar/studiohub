"""
Audit rows for deliveries, under the ``delivery`` target (docs/delivery-pipeline Q23).

Descriptions and metadata carry ids, codes, statuses and counts: never a passcode, a path or the
text of a reason or note (those live in their own columns and in the status history).
"""

from __future__ import annotations

from typing import Any

from apps.audit.models import AuditLog


def record(
    *,
    actor: Any,
    action: str,
    package: Any,
    description: str,
    metadata: dict[str, Any] | None = None,
    severity: str | None = None,
) -> None:
    extra: dict[str, Any] = {"severity": severity} if severity else {}
    AuditLog.objects.create(
        action=action,
        target_type=AuditLog.TARGET_DELIVERY,
        target_id=str(package.pk),
        target_name=package.name[:255],
        description=description,
        actor_id=getattr(actor, "pk", None),
        metadata=metadata or {},
        **extra,
    )
