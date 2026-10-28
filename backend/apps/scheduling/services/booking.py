# Django adds <fk>_id attributes at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""
Bookings (docs/scheduling/CONTRACTS.md DOM-SCH-04, decision Q32).

A resource cannot be in two places at once: two live bookings of one resource whose status is
Booked, Blocked or Overbooked may not overlap in time (a flagged Overbooked booking is still a
booking). Adjacent bookings are fine (a range includes its start and not its end), an Available slot
never blocks, and a soft-deleted booking is ignored. Being booked for more hours than the week's
capacity stays allowed and is reported (D-09); this rule is about time, not hours.

The check runs inside one transaction that first locks the resource row, so two requests for the
same resource are decided one after the other and exactly one of two competing bookings wins, on
every database. On PostgreSQL an exclusion constraint (migration 0008) holds the same rule for
writes that bypass this service (the admin, raw SQL); if it ever fires inside the service it is
reported as the same 409.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from apps.core.api.exceptions.api import ConflictException
from apps.scheduling.models import Resource, ResourceSchedule
from apps.scheduling.selectors.scope import ViewerScope

#: statuses that occupy the resource's time
BLOCKING_STATUSES = (
    ResourceSchedule.STATUS_BOOKED,
    ResourceSchedule.STATUS_BLOCKED,
    ResourceSchedule.STATUS_OVERBOOKED,
)

#: what a change must touch for the overlap to be looked at again
_TIME_FIELDS = ("resource", "start_time", "end_time", "status")
_EDITABLE = ("resource", "start_time", "end_time", "status", "event", "task", "notes")


#: the name of the PostgreSQL exclusion constraint (migration 0008)
OVERLAP_CONSTRAINT = "scheduling_booking_no_overlap"


class BookingOverlap(ConflictException):
    """The resource already has a booking in that time (409)."""

    default_detail = "This resource is already booked or blocked during that time."
    default_code = "booking_overlap"


def _actor_or_none(actor: Any):
    return actor if getattr(actor, "is_authenticated", False) else None


def _lock_resource(resource: Any) -> Resource:
    """Lock the resource row for the rest of the transaction; a deleted one is a 400."""
    locked = (
        Resource.objects.select_for_update().filter(pk=getattr(resource, "pk", resource)).first()
    )
    if locked is None:
        raise ValidationError({"resource": "Unknown resource."})
    return locked


def _describe(other: ResourceSchedule, viewer: ViewerScope | None) -> str:
    """What the refusal says about the booking in the way: its id and time, and its title only
    when the caller may see the event or task it belongs to (D-21)."""
    start = other.start_time.astimezone(UTC)
    end = other.end_time.astimezone(UTC)
    text = (
        f"booking {other.pk} ({start:%Y-%m-%d %H:%M} to {end:%Y-%m-%d %H:%M} UTC, {other.status})"
    )
    if viewer is not None and other.event_id is not None and viewer.sees_event(other.event):
        text += f" for “{other.event.title}”"
    return text


def find_overlap(
    resource_id: Any, start: datetime, end: datetime, *, exclude: Any = None
) -> ResourceSchedule | None:
    """The earliest live booking of the resource that occupies any of ``start``..``end``."""
    queryset = ResourceSchedule.objects.filter(
        resource_id=resource_id,
        status__in=BLOCKING_STATUSES,
        start_time__lt=end,
        end_time__gt=start,
    )
    if exclude is not None:
        queryset = queryset.exclude(pk=exclude)
    return queryset.select_related("event").order_by("start_time", "id").first()


def _ensure_free(
    resource_id: Any,
    start: datetime,
    end: datetime,
    status: str,
    viewer: ViewerScope | None,
    *,
    exclude: Any = None,
) -> None:
    if status not in BLOCKING_STATUSES:
        return
    other = find_overlap(resource_id, start, end, exclude=exclude)
    if other is not None:
        raise BookingOverlap(
            detail=f"This resource is already taken by {_describe(other, viewer)}.",
            code="booking_overlap",
        )


def _overlap_error(
    error: IntegrityError,
    resource_id: Any,
    start: datetime,
    end: datetime,
    viewer: ViewerScope | None,
    exclude: Any = None,
) -> Exception:
    """The 409 for a database refusal of the exclusion constraint; any other error stays as it is."""
    if OVERLAP_CONSTRAINT not in str(error):
        return error
    other = find_overlap(resource_id, start, end, exclude=exclude)
    if other is None:
        return BookingOverlap()
    return BookingOverlap(
        detail=f"This resource is already taken by {_describe(other, viewer)}.",
        code="booking_overlap",
    )


class BookingService:
    @classmethod
    @transaction.atomic
    def book(
        cls,
        *,
        actor: Any,
        resource: Any,
        start: datetime,
        end: datetime,
        status: str = ResourceSchedule.STATUS_BOOKED,
        event: Any = None,
        task: Any = None,
        notes: str = "",
        viewer: ViewerScope | None = None,
    ) -> ResourceSchedule:
        """Create a booking, refused with 409 ``booking_overlap`` when the time is taken."""
        locked = _lock_resource(resource)
        _ensure_free(locked.pk, start, end, status, viewer)
        user = _actor_or_none(actor)
        try:
            with transaction.atomic():
                return ResourceSchedule.objects.create(
                    resource=locked,
                    start_time=start,
                    end_time=end,
                    status=status,
                    event=event,
                    task=task,
                    notes=notes,
                    created_by=user,
                    updated_by=user,
                )
        except IntegrityError as error:
            raise _overlap_error(error, locked.pk, start, end, viewer) from error

    @classmethod
    @transaction.atomic
    def update(
        cls,
        *,
        actor: Any,
        booking: ResourceSchedule,
        data: dict[str, Any],
        viewer: ViewerScope | None = None,
    ) -> ResourceSchedule:
        """
        Change a booking. Moving it to another resource, other times or a blocking status looks at
        the overlap again (excluding the booking itself); changing only the notes, event or task
        does not need to.
        """
        values = {name: data[name] for name in _EDITABLE if name in data}
        target = values.get("resource", booking.resource)
        locked = _lock_resource(target)
        current = ResourceSchedule.objects.select_for_update().filter(pk=booking.pk).first()
        if current is None:
            raise ValidationError({"detail": "This booking no longer exists."})
        moved = any(
            name in values
            and (
                (values[name].pk != current.resource_id)
                if name == "resource"
                else values[name] != getattr(current, name)
            )
            for name in _TIME_FIELDS
        )
        start = values.get("start_time", current.start_time)
        end = values.get("end_time", current.end_time)
        status = values.get("status", current.status)
        if moved:
            _ensure_free(locked.pk, start, end, status, viewer, exclude=current.pk)
        for name, value in values.items():
            setattr(current, name, value)
        current.resource = locked
        current.updated_by = _actor_or_none(actor)
        try:
            with transaction.atomic():
                current.save()
        except IntegrityError as error:
            raise _overlap_error(
                error, locked.pk, start, end, viewer, exclude=current.pk
            ) from error
        return current
