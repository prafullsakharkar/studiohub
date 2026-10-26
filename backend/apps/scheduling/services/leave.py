"""
Leave decisions (DECISIONS D-20).

A leave request is decided once: Pending -> Approved or Rejected, by someone other than the
person it is for, with the row locked so two racing decisions cannot both win. The decision
is recorded with who and when. Nothing else writes a leave's status or its decision fields.
"""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING, Any

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

if TYPE_CHECKING:
    from apps.scheduling.models import ResourceLeave


def count_leave_days(start: date, end: date) -> int:
    """Calendar days from ``start`` to ``end``, both included."""
    return (end - start).days + 1


def _locked(leave_id: str) -> ResourceLeave:
    from apps.scheduling.models import ResourceLeave

    try:
        return (
            ResourceLeave.objects.select_related("resource")
            .select_for_update(of=("self",))
            .get(id=leave_id)
        )
    except ResourceLeave.DoesNotExist:
        raise NotFound("ResourceLeave not found.") from None


def _ensure_decidable(leave: ResourceLeave, actor: Any) -> None:
    if leave.status != leave.STATUS_PENDING:
        raise ValidationError(
            {"status": [f"Only a pending leave can be decided; this one is {leave.status}."]}
        )
    if leave.resource.user_id is not None and leave.resource.user_id == getattr(actor, "pk", None):
        raise PermissionDenied("You cannot decide your own leave.")


@transaction.atomic
def approve_leave(*, leave_id: str, actor: Any) -> ResourceLeave:
    """Pending -> Approved by ``actor``, now."""
    leave = _locked(leave_id)
    _ensure_decidable(leave, actor)
    leave.status = leave.STATUS_APPROVED
    leave.approved_by = actor
    leave.approved_at = timezone.now()
    leave.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
    return leave


@transaction.atomic
def reject_leave(*, leave_id: str, actor: Any, rejection_reason: str) -> ResourceLeave:
    """Pending -> Rejected by ``actor``, now; the reason is required."""
    reason = (rejection_reason or "").strip()
    if not reason:
        raise ValidationError({"rejection_reason": ["A reason is required to reject a leave."]})
    leave = _locked(leave_id)
    _ensure_decidable(leave, actor)
    leave.status = leave.STATUS_REJECTED
    leave.rejected_by = actor
    leave.rejected_at = timezone.now()
    leave.rejection_reason = reason
    leave.save(
        update_fields=["status", "rejected_by", "rejected_at", "rejection_reason", "updated_at"]
    )
    return leave
