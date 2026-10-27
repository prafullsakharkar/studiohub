# Django adds <fk>_id attributes at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""
Leave requests and decisions (DECISIONS D-20, docs/scheduling/CONTRACTS.md DOM-SCH-05).

**Requests.** Everyone files leave for their own resource; leave for someone else's resource needs
``schedule.manage`` (anyone else gets "Unknown resource", the same answer as for an id that does not
exist). A resource cannot have two pending or approved leaves that overlap, and a request cannot be
moved to another resource. The resource row is locked while the overlap is checked, so two racing
requests cannot both win.

**Decisions.** A leave request is decided once: Pending -> Approved or Rejected, by someone other
than the person it is for, with the row locked so two racing decisions cannot both win. The one
exception is a holder of ``schedule.sod.override`` who gives a reason: the decision is made and
recorded as an override. The decision is recorded with who and when, and in the audit log. Nothing
else writes a leave's status or its decision fields.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.audit.models import AuditLog
from apps.scheduling.models import Resource, ResourceLeave
from apps.scheduling.services import audit
from apps.scheduling.services.access import owns


def count_leave_days(start: date, end: date) -> int:
    """
    Calendar days from ``start`` to ``end``, both included.

    How leave was counted before work calendars (D-20). New requests use ``working_leave_days``;
    this stays for the rows that were counted this way and for the report that compares the two.
    """
    return (end - start).days + 1


def working_leave_days(resource: Any, start: date, end: date) -> int:
    """
    Working days from ``start`` to ``end``, both included, in the calendar ``resource`` follows
    (decision Q20): weekends the calendar does not work and its non-optional holidays do not count.
    A resource with no calendar follows the default calendar.
    """
    from apps.scheduling.domain.calendar import working_days
    from apps.scheduling.selectors.calendar import CalendarSelector

    rules, holidays = CalendarSelector.rules_and_holidays(resource, start, end)
    return working_days(rules, start, end, holidays)


def _locked(leave_id: Any) -> ResourceLeave:
    try:
        return (
            ResourceLeave.objects.select_related("resource")
            .select_for_update(of=("self",))
            .get(id=leave_id)
        )
    except ResourceLeave.DoesNotExist:
        raise NotFound("ResourceLeave not found.") from None


UNKNOWN_RESOURCE = "Unknown resource."
NO_OWN_RESOURCE = "No scheduling resource is associated with the current user."

#: leave in these states occupies the resource's days
HOLDING_STATUSES = (ResourceLeave.STATUS_PENDING, ResourceLeave.STATUS_APPROVED)


def _lock_resource(resource: Any) -> Resource:
    locked = (
        Resource.objects.select_for_update().filter(pk=getattr(resource, "pk", resource)).first()
    )
    if locked is None:
        raise ValidationError({"resource": [UNKNOWN_RESOURCE]})
    return locked


def resolve_resource(actor: Any, requested: Any, *, manager: bool) -> Resource:
    """
    The resource a new leave is for: the one named, if the caller manages the schedule or it is
    their own; the caller's own when none is named. Anything else is "Unknown resource", the same
    answer as for an id that does not exist, so it tells nothing about other people's resources.
    """
    if requested is None:
        own = Resource.objects.filter(user=actor).first()
        if own is None:
            raise ValidationError({"resource": [NO_OWN_RESOURCE]})
        return own
    if manager or owns(actor, requested):
        return requested
    raise ValidationError({"resource": [UNKNOWN_RESOURCE]})


def ensure_no_overlap(resource: Any, start: date, end: date, *, exclude: Any = None) -> None:
    """A resource has at most one pending or approved leave on any day (400 otherwise)."""
    clash = ResourceLeave.objects.filter(
        resource_id=resource.pk,
        status__in=HOLDING_STATUSES,
        start_date__lte=end,
        end_date__gte=start,
    )
    if exclude is not None:
        clash = clash.exclude(pk=exclude)
    other = clash.order_by("start_date", "id").first()
    if other is not None:
        raise ValidationError(
            {
                "start_date": [
                    f"This resource already has {other.status.lower()} leave from "
                    f"{other.start_date} to {other.end_date} that overlaps these dates."
                ]
            }
        )


@transaction.atomic
def create_leave(
    *, actor: Any, manager: bool, requested: Any, data: dict[str, Any]
) -> ResourceLeave:
    """File a pending leave request (see the module notes for who may file for whom)."""
    resource = _lock_resource(resolve_resource(actor, requested, manager=manager))
    start, end = data["start_date"], data["end_date"]
    ensure_no_overlap(resource, start, end)
    user = actor if getattr(actor, "is_authenticated", False) else None
    extra = {name: data[name] for name in ("leave_type", "reason") if name in data}
    return ResourceLeave.objects.create(
        resource=resource,
        start_date=start,
        end_date=end,
        total_days=working_leave_days(resource, start, end),
        created_by=user,
        updated_by=user,
        **extra,
    )


@transaction.atomic
def update_leave(
    *, actor: Any, manager: bool, leave: ResourceLeave, data: dict[str, Any]
) -> ResourceLeave:
    """Change a pending request: its own person or a manager; never to another resource."""
    locked = _locked(leave.pk)
    if locked.status != ResourceLeave.STATUS_PENDING:
        raise ValidationError({"status": ["Only a pending leave can be changed."]})
    if not (manager or owns(actor, locked.resource)):
        raise PermissionDenied("You may only change your own leave.")
    moved_to = data.get("resource")
    if moved_to is not None and moved_to.pk != locked.resource_id:
        raise ValidationError(
            {"resource": ["A leave cannot be moved to another resource; file a new request."]}
        )
    start = data.get("start_date", locked.start_date)
    end = data.get("end_date", locked.end_date)
    if (start, end) != (locked.start_date, locked.end_date):
        resource = _lock_resource(locked.resource)
        ensure_no_overlap(resource, start, end, exclude=locked.pk)
    for name in ("leave_type", "reason", "start_date", "end_date", "total_days"):
        if name in data:
            setattr(locked, name, data[name])
    locked.updated_by = actor if getattr(actor, "is_authenticated", False) else None
    locked.save()
    return locked


def _ensure_decidable(
    leave: ResourceLeave, actor: Any, *, can_override: bool, override_reason: str
) -> bool:
    """
    Whether this decision is an override of the rule that nobody decides their own leave.

    Raises 400 unless the leave is pending; 403 when it is the actor's own and they do not hold
    the override code; 400 when they hold it but give no reason.
    """
    if leave.status != leave.STATUS_PENDING:
        raise ValidationError(
            {"status": [f"Only a pending leave can be decided; this one is {leave.status}."]}
        )
    if not owns(actor, leave.resource):
        return False
    if not can_override:
        raise PermissionDenied("You cannot decide your own leave.")
    if not override_reason.strip():
        raise ValidationError(
            {"override_reason": ["A reason is required to decide your own leave."]}
        )
    return True


def _record_decision(
    leave: ResourceLeave, actor: Any, decision: str, *, overridden: bool, override_reason: str
) -> None:
    metadata: dict[str, Any] = {
        "event": f"leave.{decision}",
        "resource": leave.resource.code,
        "start_date": str(leave.start_date),
        "end_date": str(leave.end_date),
        "overridden": overridden,
    }
    if overridden:
        metadata["override_reason"] = override_reason.strip()[:500]
    audit.record(
        actor=actor,
        action=AuditLog.ACTION_UPDATE,
        target_id=leave.pk,
        target_name=f"Leave {leave.resource.code} {leave.start_date}..{leave.end_date}",
        description=(
            f"Leave of {leave.resource.code} {decision}"
            + (" by the person it is for (override)" if overridden else "")
        ),
        metadata=metadata,
        severity=AuditLog.SEVERITY_WARNING if overridden else None,
    )


@transaction.atomic
def approve_leave(
    *, leave_id: Any, actor: Any, can_override: bool = False, override_reason: str = ""
) -> ResourceLeave:
    """Pending -> Approved by ``actor``, now."""
    leave = _locked(leave_id)
    overridden = _ensure_decidable(
        leave, actor, can_override=can_override, override_reason=override_reason
    )
    leave.status = leave.STATUS_APPROVED
    leave.approved_by = actor
    leave.approved_at = timezone.now()
    leave.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
    _record_decision(
        leave, actor, "approved", overridden=overridden, override_reason=override_reason
    )
    return leave


@transaction.atomic
def reject_leave(
    *,
    leave_id: Any,
    actor: Any,
    rejection_reason: str,
    can_override: bool = False,
    override_reason: str = "",
) -> ResourceLeave:
    """Pending -> Rejected by ``actor``, now; the reason is required."""
    reason = (rejection_reason or "").strip()
    if not reason:
        raise ValidationError({"rejection_reason": ["A reason is required to reject a leave."]})
    leave = _locked(leave_id)
    overridden = _ensure_decidable(
        leave, actor, can_override=can_override, override_reason=override_reason
    )
    leave.status = leave.STATUS_REJECTED
    leave.rejected_by = actor
    leave.rejected_at = timezone.now()
    leave.rejection_reason = reason
    leave.save(
        update_fields=["status", "rejected_by", "rejected_at", "rejection_reason", "updated_at"]
    )
    _record_decision(
        leave, actor, "rejected", overridden=overridden, override_reason=override_reason
    )
    return leave
