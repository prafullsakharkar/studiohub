"""
Scheduling services for business logic.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.scheduling.models import CalendarEvent, Resource, ResourceSchedule, ResourceLeave, Holiday
    from apps.identity.models import User


def create_calendar_event(
    *,
    title: str,
    organization_id: str,
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
) -> "CalendarEvent":
    """Create a new calendar event."""
    from apps.scheduling.models import CalendarEvent
    from apps.organization.models import Organization
    
    org = Organization.objects.get(id=organization_id)
    
    event = CalendarEvent.objects.create(
        title=title,
        organization=org,
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


def update_calendar_event_status(
    *,
    event_id: str,
    status: str,
    user_id: str | None = None,
) -> "CalendarEvent":
    """Update calendar event status."""
    from apps.scheduling.models import CalendarEvent
    
    event = CalendarEvent.objects.get(id=event_id)
    event.status = status
    event.save(update_fields=["status"])
    
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
) -> "ResourceSchedule":
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
) -> "ResourceSchedule":
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
) -> "ResourceLeave":
    """Submit a leave request."""
    from apps.scheduling.models import Resource, ResourceLeave
    
    resource = Resource.objects.get(id=resource_id)
    
    # Calculate total days
    from datetime import date
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    total_days = (end - start).days + 1
    
    leave = ResourceLeave.objects.create(
        resource=resource,
        leave_type=leave_type,
        start_date=start_date,
        end_date=end_date,
        total_days=total_days,
        reason=reason,
    )
    
    return leave


def approve_leave(
    *,
    leave_id: str,
    user_id: str,
) -> "ResourceLeave":
    """Approve a leave request."""
    from apps.scheduling.models import ResourceLeave
    
    leave = ResourceLeave.objects.get(id=leave_id)
    leave.status = "Approved"
    leave.approved_by_id = user_id
    leave.approved_at = leave.updated_at
    leave.save(update_fields=["status", "approved_by", "approved_at"])
    
    return leave


def reject_leave(
    *,
    leave_id: str,
    rejection_reason: str,
) -> "ResourceLeave":
    """Reject a leave request."""
    from apps.scheduling.models import ResourceLeave
    
    leave = ResourceLeave.objects.get(id=leave_id)
    leave.status = "Rejected"
    leave.rejection_reason = rejection_reason
    leave.save(update_fields=["status", "rejection_reason"])
    
    return leave


def create_holiday(
    *,
    name: str,
    organization_id: str,
    holiday_date: str,
    is_paid: bool = True,
    is_optional: bool = False,
    description: str = "",
) -> "Holiday":
    """Create a company holiday."""
    from apps.scheduling.models import Holiday
    from apps.organization.models import Organization
    
    org = Organization.objects.get(id=organization_id)
    
    holiday = Holiday.objects.create(
        name=name,
        organization=org,
        holiday_date=holiday_date,
        is_paid=is_paid,
        is_optional=is_optional,
        description=description,
    )
    
    return holiday
