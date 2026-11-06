"""
Audit rows for production bulk writes: one ``AuditLog`` per committed batch (CR-48).

Each row the batch writes has its own ``ChangeLog`` entry (the change-tracking signals); this row
says who ran the batch, on which project, and what came of it. Metadata carries ids and counts only.
"""

from __future__ import annotations

from typing import Any

from apps.audit.models import AuditLog

#: bulk operation -> audit action (``AuditLog.ACTION_CHOICES``)
_ACTIONS = {"create": AuditLog.ACTION_IMPORT, "update": AuditLog.ACTION_UPDATE}


def record_bulk_batch(
    *,
    actor: Any,
    model: Any,
    operation: str,
    operation_id: str,
    project_ids: list[str],
    counts: dict[str, int],
    atomic: bool,
) -> AuditLog:
    """The audit row of one committed bulk ``operation`` ("create" / "update") over ``model`` rows."""
    noun = model.__name__.lower()
    target_type = getattr(AuditLog, f"TARGET_{noun.upper()}", AuditLog.TARGET_PROJECT)
    single = project_ids[0] if len(project_ids) == 1 else None
    written = counts.get("successful", 0)
    return AuditLog.objects.create(
        action=_ACTIONS[operation],
        target_type=target_type,
        target_id=operation_id,
        target_name=f"bulk {operation} of {written} {noun}{'' if written == 1 else 's'}"[:255],
        project_id=single,
        description=f"Bulk {operation}: {written} of {counts.get('total', 0)} {noun} rows written.",
        actor_id=getattr(actor, "pk", None),
        metadata={
            "operation": f"bulk_{operation}",
            "operation_id": operation_id,
            "atomic": atomic,
            "project_ids": project_ids,
            "counts": counts,
        },
    )
