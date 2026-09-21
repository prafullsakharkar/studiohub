"""
Capacity / overbooking aggregation selectors.

Computes the frontend `SchedulingCapacitySummary[]` and
`SchedulingOverbookingAlert[]` shapes from real `Resource` /
`ResourceSchedule` rows. The aggregation window is the current calendar week
(Monday 00:00 UTC → Sunday 24:00 UTC); slots partially overlapping the window
contribute only their overlapping hours. Only `Booked`/`Overbooked` slots
consume capacity.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from django.utils import timezone

# Backend resource_type → frontend ResourceCategory. The frontend union has no
# Room/Studio members; bookable rooms/studios surface as 'office' (a place).
RESOURCE_TYPE_MAP = {
    "Person": "person",
    "Equipment": "equipment",
    "Room": "office",
    "Studio": "office",
}

# Backend CalendarEvent.event_type → frontend CalendarEventType. Deadline and
# Work Block have no exact frontend members; they map to the closest meaning.
EVENT_TYPE_MAP = {
    "Meeting": "meeting",
    "Deadline": "milestone",
    "Milestone": "milestone",
    "Review Session": "review",
    "Holiday": "holiday",
    "Leave": "leave",
    "Work Block": "task",
}

ALLOCATED_STATUSES = ("Booked", "Overbooked")
UNASSIGNED_DEPARTMENT = "Unassigned"


def current_week_bounds(now: datetime | None = None) -> tuple[datetime, datetime]:
    """Return (week_start, week_end) datetimes for the current week (UTC)."""
    now = now or timezone.now()
    week_start = (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return week_start, week_start + timedelta(days=7)


def week_bounds_from_date(week_start_date) -> tuple[datetime, datetime]:
    """Return (week_start, week_end) for the week containing the given date."""
    start = datetime(
        week_start_date.year, week_start_date.month, week_start_date.day,
        tzinfo=UTC,
    )
    start = start - timedelta(days=start.weekday())
    return start, start + timedelta(days=7)


def _overlap_hours(start, end, window_start, window_end) -> float:
    overlap = (min(end, window_end) - max(start, window_start)).total_seconds() / 3600
    return max(0.0, overlap)


def _week_slots(organization, week_start, week_end):
    from apps.scheduling.models import ResourceSchedule

    return (
        ResourceSchedule.objects.filter(
            resource__organization=organization,
            status__in=ALLOCATED_STATUSES,
            start_time__lt=week_end,
            end_time__gt=week_start,
        )
        .select_related("resource", "resource__department", "event", "event__project", "task")
        .order_by("start_time")
    )


def _allocated_hours_by_resource(organization, week_start, week_end) -> dict:
    hours: dict[Any, float] = {}
    for slot in _week_slots(organization, week_start, week_end):
        hours[slot.resource_id] = (
            hours.get(slot.resource_id, 0.0)
            + _overlap_hours(slot.start_time, slot.end_time, week_start, week_end)
        )
    return hours


def get_capacity_summary(organization) -> list[dict[str, Any]]:
    """Per-department capacity summary for the current week (frontend shape)."""
    from apps.scheduling.models import Resource

    week_start, week_end = current_week_bounds()
    hours = _allocated_hours_by_resource(organization, week_start, week_end)

    groups: dict[str, dict[str, Any]] = {}
    resources = Resource.objects.filter(organization=organization).select_related("department")
    for resource in resources:
        department = resource.department.name if resource.department else UNASSIGNED_DEPARTMENT
        group = groups.setdefault(
            department,
            {
                "department": department,
                "total_resources": 0,
                "total_capacity_hours": 0,
                "allocated_hours": 0.0,
                "overbooked_count": 0,
            },
        )
        allocated = round(hours.get(resource.id, 0.0), 2)
        group["total_resources"] += 1
        group["total_capacity_hours"] += resource.capacity_hours_per_week
        group["allocated_hours"] = round(group["allocated_hours"] + allocated, 2)
        if allocated > resource.capacity_hours_per_week:
            group["overbooked_count"] += 1

    summaries = []
    for group in groups.values():
        capacity = group["total_capacity_hours"]
        allocated = group["allocated_hours"]
        summaries.append(
            {
                "department": group["department"],
                "total_resources": group["total_resources"],
                "total_capacity_hours": capacity,
                "allocated_hours": allocated,
                "free_hours": round(max(capacity - allocated, 0), 2),
                "utilization_pct": round(allocated / capacity * 100, 1) if capacity else 0.0,
                "overbooked_count": group["overbooked_count"],
            }
        )
    return sorted(summaries, key=lambda row: row["department"])


def _conflicting_event(slot) -> dict[str, Any]:
    event = slot.event
    task = slot.task
    if event is not None:
        title = event.title
        event_type = EVENT_TYPE_MAP.get(event.event_type, "meeting")
        project = getattr(event, "project", None)
        project_code = getattr(project, "code", None)
    elif task is not None:
        title = getattr(task, "title", None) or getattr(task, "name", None) or "Scheduled booking"
        event_type = "task"
        project_code = None
    else:
        title = slot.notes or "Scheduled booking"
        event_type = "meeting"
        project_code = None
    return {
        "id": str(slot.id),
        "title": title,
        "project_code": project_code,
        "event_type": event_type,
        "hours": 0.0,  # filled by caller with clipped hours
    }


def get_overbooking_alerts(organization) -> list[dict[str, Any]]:
    """Overbooking alerts for resources exceeding weekly capacity."""
    from apps.scheduling.models import Resource

    week_start, week_end = current_week_bounds()
    hours = _allocated_hours_by_resource(organization, week_start, week_end)

    slots_by_resource: dict[Any, list] = {}
    for slot in _week_slots(organization, week_start, week_end):
        slots_by_resource.setdefault(slot.resource_id, []).append(slot)

    alerts = []
    resources = Resource.objects.filter(organization=organization).select_related("department")
    for resource in resources:
        allocated = round(hours.get(resource.id, 0.0), 2)
        capacity = resource.capacity_hours_per_week
        if allocated <= capacity:
            continue
        excess = round(allocated - capacity, 2)
        conflicting = []
        for slot in slots_by_resource.get(resource.id, []):
            entry = _conflicting_event(slot)
            entry["hours"] = round(
                _overlap_hours(slot.start_time, slot.end_time, week_start, week_end), 2
            )
            conflicting.append(entry)
        alerts.append(
            {
                "id": f"ob-{resource.id}-{week_start:%Y%m%d}",
                "resource_id": str(resource.id),
                "resource_name": resource.name,
                "resource_type": RESOURCE_TYPE_MAP.get(resource.resource_type, "equipment"),
                "department": resource.department.name if resource.department else None,
                "date": week_start.date().isoformat(),
                "scheduled_hours": allocated,
                "max_capacity_hours": capacity,
                "excess_hours": excess,
                "conflicting_events": conflicting,
                "suggested_resolution": (
                    f"Reassign {excess}h from {resource.name} or extend the timeline."
                ),
            }
        )
    return sorted(alerts, key=lambda alert: (-alert["excess_hours"], alert["resource_name"]))
