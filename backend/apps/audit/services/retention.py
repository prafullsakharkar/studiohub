"""
Audit retention (TPN review TM-011).

The audit tables are append-only: a database trigger refuses UPDATE and DELETE (migration 0003).
Retention is the one sanctioned way rows leave. It runs in a transaction that switches the trigger's
purge flag on for that transaction only (``set_config(..., true)`` is transaction-local), deletes
rows older than the configured window in batches, and writes one ``AuditLog`` row saying what was
removed, so a purge is itself on the record.

Used by the ``audit.purge`` Celery task and the ``audit_purge`` management command.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone

from apps.audit.models.api_request import APIRequest
from apps.audit.models.audit_log import AuditLog
from apps.audit.models.change_log import ChangeLog
from apps.audit.models.track import Track

BATCH_SIZE = 5000

# (label, model, setting holding the retention in days, append-only guarded by the trigger)
TARGETS: tuple[tuple[str, Any, str, bool], ...] = (
    ("audit_logs", AuditLog, "AUDIT_RETENTION_DAYS", True),
    ("change_logs", ChangeLog, "AUDIT_RETENTION_DAYS", True),
    ("api_requests", APIRequest, "API_REQUEST_RETENTION_DAYS", True),
    ("tracks", Track, "TRACK_RETENTION_DAYS", False),
)


def _allow_purge() -> None:
    """Let the append-only trigger accept DELETE for the rest of this transaction."""
    if connection.vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute("SELECT set_config('studiohub.audit_purge', 'on', true)")


def _purge_batch(model: Any, cutoff: Any) -> int:
    ids = list(
        model.objects.filter(created_at__lt=cutoff)
        .order_by("created_at")
        .values_list("pk", flat=True)[:BATCH_SIZE]
    )

    if not ids:
        return 0

    with transaction.atomic():
        _allow_purge()
        return model.objects.filter(pk__in=ids)._raw_delete(using=model.objects.db)  # type: ignore[attr-defined]


def purge_expired(*, dry_run: bool = False, now: Any = None) -> dict[str, int]:
    """
    Remove audit rows older than their retention window and return ``{table: rows}``.

    A window of 0 (or less) keeps that table. With ``dry_run`` nothing is deleted and the counts are
    the rows that would go.
    """
    now = now or timezone.now()
    counts: dict[str, int] = {}

    for label, model, setting_name, _guarded in TARGETS:
        days = int(getattr(settings, setting_name, 0) or 0)

        if days <= 0:
            counts[label] = 0
            continue

        cutoff = now - timedelta(days=days)

        if dry_run:
            counts[label] = model.objects.filter(created_at__lt=cutoff).count()
            continue

        total = 0
        while True:
            removed = _purge_batch(model, cutoff)
            total += removed
            if removed < BATCH_SIZE:
                break
        counts[label] = total

    if not dry_run and any(counts.values()):
        # Written after the purge so it is never itself a purge candidate.
        AuditLog.objects.create(
            action=AuditLog.ACTION_DELETE,
            target_type=AuditLog.TARGET_AUDIT,
            target_id="retention",
            target_name="Audit retention",
            description="Expired audit rows purged by retention policy",
            severity=AuditLog.SEVERITY_INFO,
            metadata={"removed": counts, "run_at": now.isoformat()},
        )

    return counts
