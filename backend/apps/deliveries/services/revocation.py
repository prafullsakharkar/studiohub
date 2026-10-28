"""
What happens to deliveries when Publishing revokes a file (docs/deliveries/CONTRACTS.md DOM-DLV-08).

Run after the revoking transaction commits, once per revoked file; safe to run again.

* Draft, Validating, Prepared: the current QC run is no longer valid, so ``qc_run_id`` is cleared;
  the next prepare or sign-off needs a new run.
* Signed Off: moved back to Prepared by the system (history ``override_kind="system"``,
  reason "content revoked") so it cannot be sent with revoked content.
* Sent (Submitted, Approved, Rejected, Complete): unchanged. The detail shows
  ``has_revoked_content`` and an audit row says which delivery held the file.
* Cancelled: nothing to do.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from django.db import transaction

from apps.audit.models import AuditLog
from apps.deliveries.constants import workflow as wf
from apps.deliveries.models import DeliveryPackage, DeliveryVersionRef
from apps.deliveries.services import audit, transitions

REASON = "content revoked"


def on_file_revoked(*, file_id: Any, version_id: Any) -> dict[str, int]:
    """Apply a revocation to every delivery holding the version. Returns counts, for tests and logs."""
    counts = {"qc_invalidated": 0, "reopened": 0, "sent_noted": 0}
    delivery_ids = list(
        DeliveryVersionRef.objects.filter(version_id=version_id)
        .values_list("delivery_id", flat=True)
        .distinct()
    )
    for delivery_id in delivery_ids:
        with transaction.atomic():
            try:
                package = DeliveryPackage.objects.select_for_update().get(pk=delivery_id)
            except DeliveryPackage.DoesNotExist:
                continue
            if package.status == wf.SIGNED_OFF:
                transitions.move(
                    package,
                    wf.PREPARED,
                    actor=None,
                    system=True,
                    reason=REASON,
                    extra={"signed_off_by": None, "signed_off_at": None, "qc_run_id": None},
                )
                audit.record(
                    actor=None,
                    action=AuditLog.ACTION_UPDATE,
                    package=package,
                    description=f"Delivery {package.code} sign-off withdrawn: a file was revoked",
                    metadata={"file_id": str(file_id), "version_id": str(version_id)},
                )
                counts["reopened"] += 1
            elif package.status in wf.WORKING_STATES:
                if package.qc_run_id is not None:
                    package.qc_run_id = None
                    package.save(update_fields=["qc_run_id", "updated_at"])
                    counts["qc_invalidated"] += 1
            elif package.status in wf.SENT_STATES and not _already_noted(package, file_id):
                audit.record(
                    actor=None,
                    action=AuditLog.ACTION_UPDATE,
                    package=package,
                    description=f"Delivery {package.code} holds a file that was revoked after it was sent",
                    metadata={"file_id": str(file_id), "version_id": str(version_id)},
                    severity=AuditLog.SEVERITY_WARNING,
                )
                counts["sent_noted"] += 1
    return counts


def _already_noted(package: DeliveryPackage, file_id: Any) -> bool:
    return AuditLog.objects.filter(
        target_type=AuditLog.TARGET_DELIVERY,
        target_id=str(package.pk),
        metadata__file_id=str(UUID(str(file_id))),
    ).exists()
