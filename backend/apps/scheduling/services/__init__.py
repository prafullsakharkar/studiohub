"""
Scheduling services for business logic.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from apps.scheduling.services.leave import (
    approve_leave,
    count_leave_days,
    reject_leave,
    working_leave_days,
)

__all__ = [
    "approve_leave",
    "block_resource",
    "book_resource",
    "count_leave_days",
    "create_calendar_event",
    "create_holiday",
    "ensure_event_status_change",
    "reject_leave",
    "submit_leave_request",
    "update_calendar_event",
    "update_calendar_event_status",
    "working_leave_days",
]

if TYPE_CHECKING:
    from apps.scheduling.models import (
        CalendarEvent,
        Holiday,
        ResourceLeave,
        ResourceSchedule,
    )


def create_calendar_event(
    *,
    title: str,
    start_time: str,
    end_time: str,
    event_type: str = "Meeting",
    status: str = "Scheduled",
    visibility: str = "Team",
    project_id: str | None = None,
    description: str = "",
    location: str = "",
    meeting_url: str = "",
    is_all_day: bool = False,
    created_by_id: str | None = None,
) -> CalendarEvent:
    """Create a new calendar event."""
    from apps.scheduling.models import CalendarEvent

    event = CalendarEvent.objects.create(
        title=title,
        start_time=start_time,
        end_time=end_time,
        event_type=event_type,
        status=status,
        visibility=visibility,
        project_id=project_id,
        description=description,
        location=location,
        meeting_url=meeting_url,
        is_all_day=is_all_day,
        created_by_id=created_by_id,
    )

    return event


#: a finished or cancelled event stays so; the other states move freely (D-22)
EVENT_FINAL_STATUSES = ("Completed", "Cancelled")


def ensure_event_status_change(current: str, new: str) -> None:
    """Raise a 400 unless ``new`` is a known status the event may move to from ``current``."""
    from rest_framework.exceptions import ValidationError

    from apps.scheduling.models import CalendarEvent

    if new not in {value for value, _ in CalendarEvent.STATUS_CHOICES}:
        raise ValidationError({"status": [f'Unknown status "{new}".']})
    if current in EVENT_FINAL_STATUSES and new != current:
        raise ValidationError({"status": [f"A {current} event cannot change status."]})


def update_calendar_event_status(
    *,
    event_id: str,
    status: str,
    user_id: str | None = None,
) -> CalendarEvent:
    """Update calendar event status (known statuses only; Completed and Cancelled are final)."""
    from django.db import transaction

    from apps.scheduling.models import CalendarEvent

    with transaction.atomic():
        event = CalendarEvent.objects.select_for_update().get(id=event_id)
        ensure_event_status_change(event.status, status)
        event.status = status
        event.save(update_fields=["status", "updated_at"])

    return event


def update_calendar_event(*, event: CalendarEvent, data: dict[str, Any]) -> CalendarEvent:
    """Apply an edit; a status in it follows the same rules as ``update_calendar_event_status``."""
    if "status" in data:
        ensure_event_status_change(event.status, data["status"])
    for name, value in data.items():
        setattr(event, name, value)
    event.save()
    return event


def book_resource(
    *,
    resource_id: str,
    start_time: str,
    end_time: str,
    event_id: str | None = None,
    task_id: str | None = None,
    status: str = "Booked",
    notes: str = "",
) -> ResourceSchedule:
    """Book a resource for a time slot."""
    from apps.scheduling.models import Resource, ResourceSchedule

    resource = Resource.objects.get(id=resource_id)

    schedule = ResourceSchedule.objects.create(
        resource=resource,
        start_time=start_time,
        end_time=end_time,
        event_id=event_id,
        task_id=task_id,
        status=status,
        notes=notes,
    )

    return schedule


def block_resource(
    *,
    resource_id: str,
    start_time: str,
    end_time: str,
    reason: str = "",
) -> ResourceSchedule:
    """Block a resource (mark as unavailable)."""
    from apps.scheduling.models import Resource, ResourceSchedule

    resource = Resource.objects.get(id=resource_id)

    schedule = ResourceSchedule.objects.create(
        resource=resource,
        start_time=start_time,
        end_time=end_time,
        status="Blocked",
        notes=reason,
    )

    return schedule


def submit_leave_request(
    *,
    resource_id: str,
    leave_type: str,
    start_date: str,
    end_date: str,
    reason: str = "",
) -> ResourceLeave:
    """Submit a leave request."""
    from apps.scheduling.models import Resource, ResourceLeave

    resource = Resource.objects.get(id=resource_id)

    from datetime import date

    total_days = count_leave_days(date.fromisoformat(start_date), date.fromisoformat(end_date))

    leave = ResourceLeave.objects.create(
        resource=resource,
        leave_type=leave_type,
        start_date=start_date,
        end_date=end_date,
        total_days=total_days,
        reason=reason,
    )

    return leave


def create_holiday(
    *,
    name: str,
    holiday_date: str,
    is_paid: bool = True,
    is_optional: bool = False,
    description: str = "",
) -> Holiday:
    """Create a company holiday."""
    from apps.scheduling.models import Holiday

    holiday = Holiday.objects.create(
        name=name,
        holiday_date=holiday_date,
        is_paid=is_paid,
        is_optional=is_optional,
        description=description,
    )

    return holiday
