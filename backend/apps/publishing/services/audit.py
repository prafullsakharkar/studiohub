"""
Audit rows for publishing, under the ``publishing`` target (docs/delivery-pipeline Q23).

Descriptions and metadata carry ids, codes and statuses, never paths of revoked files,
checksums, or the text of a reason.
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
) -> None:
    AuditLog.objects.create(
        action=action,
        target_type=AuditLog.TARGET_PUBLISHING,
        target_id=str(target_id),
        target_name=target_name[:255],
        description=description,
        actor_id=getattr(actor, "pk", None),
        metadata=metadata or {},
    )
