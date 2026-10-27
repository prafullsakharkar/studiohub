"""
Capacity / overbooking aggregation selectors.

Computes the frontend `SchedulingCapacitySummary[]` and
`SchedulingOverbookingAlert[]` shapes from real `Resource` /
`ResourceSchedule` rows. The aggregation window is the current calendar week
of each resource: Monday 00:00 to the next Monday 00:00 in the time zone of the
work calendar the resource follows (docs/scheduling/CONTRACTS.md section 1); a
resource with no calendar follows the default one, which is UTC out of the box.
Slots partially overlapping the window contribute only their overlapping hours.
Only `Booked`/`Overbooked` slots consume capacity. Leave and holidays reduce
capacity from Phase 10; for now capacity is the resource's weekly figure.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from django.utils import timezone

from apps.scheduling.domain.calendar import (
    DEFAULT_RULES,
    CalendarRules,
    week_bounds,
    week_bounds_for_date,
)
from apps.scheduling.selectors.calendar import CalendarSelector, rules_of

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


def current_week_bounds(
    now: datetime | None = None, rules: CalendarRules = DEFAULT_RULES
) -> tuple[datetime, datetime]:
    """Return (week_start, week_end) in UTC of the current week in the calendar's time zone."""
    return week_bounds(rules, now or timezone.now())


def week_bounds_from_date(
    week_start_date: date, rules: CalendarRules = DEFAULT_RULES
) -> tuple[datetime, datetime]:
    """Return (week_start, week_end) in UTC of the week containing the given local date."""
    return week_bounds_for_date(rules, week_start_date)


def _overlap_hours(start, end, window_start, window_end) -> float:
    overlap = (min(end, window_end) - max(start, window_start)).total_seconds() / 3600
    return max(0.0, overlap)


def _slots_in(window_start, window_end, resource_ids=None):
    from apps.scheduling.models import ResourceSchedule

    queryset = ResourceSchedule.objects.filter(
        status__in=ALLOCATED_STATUSES,
        start_time__lt=window_end,
        end_time__gt=window_start,
    )
    if resource_ids is not None:
        queryset = queryset.filter(resource_id__in=resource_ids)
    return queryset.select_related(
        "resource", "resource__department", "event", "event__project", "task"
    ).order_by("start_time")


def _week_slots(organization=None, week_start=None, week_end=None, **kwargs):
    # ``organization`` is accepted for backwards compatibility with callers
    # that have not been migrated off org-scoped resolution yet; it is ignored,
    # capacity aggregates platform-wide.
    if week_start is None or week_end is None:
        week_start, week_end = current_week_bounds()
    return _slots_in(week_start, week_end, kwargs.get("resource_ids"))


@dataclass
class ResourceWeek:
    """One resource's week: the calendar it follows, the window and the bookings inside it."""

    resource: Any
    rules: CalendarRules
    start: datetime
    end: datetime
    slots: list[Any]
    hours: float

    @property
    def day(self) -> date:
        """The Monday of the window, as a date in the calendar's zone (what an alert id carries)."""
        return self.start.astimezone(self.rules.tz).date()


def week_window_for(
    resource: Any, *, week_day: date | None = None, now: datetime | None = None
) -> tuple[CalendarRules, datetime, datetime]:
    """The rules ``resource`` follows and its week window (the current one, or the one of ``week_day``)."""
    rules = CalendarSelector.rules_for(resource)
    if week_day is not None:
        start, end = week_bounds_for_date(rules, week_day)
    else:
        start, end = week_bounds(rules, now or timezone.now())
    return rules, start, end


def resource_weeks(
    *, now: datetime | None = None, week_day: date | None = None
) -> list[ResourceWeek]:
    """
    Every resource with its own week window and its allocated hours.

    Resources that follow the same rules share one window and one query; a studio on a single
    calendar costs the same as before.
    """
    from apps.scheduling.models import Resource

    now = now or timezone.now()
    default_rules = rules_of(CalendarSelector.default_calendar())
    resources = list(Resource.objects.select_related("department", "calendar"))
    groups: dict[CalendarRules, list[Any]] = {}
    for resource in resources:
        own = resource.calendar
        rules = default_rules if own is None or own.is_deleted else rules_of(own)
        groups.setdefault(rules, []).append(resource)

    weeks: list[ResourceWeek] = []
    for rules, members in groups.items():
        start, end = (
            week_bounds_for_date(rules, week_day)
            if week_day is not None
            else week_bounds(rules, now)
        )
        slots_by_resource: dict[Any, list[Any]] = {}
        for slot in _slots_in(start, end, [member.id for member in members]):
            slots_by_resource.setdefault(slot.resource_id, []).append(slot)
        for member in members:
            slots = slots_by_resource.get(member.id, [])
            hours = sum(
                _overlap_hours(slot.start_time, slot.end_time, start, end) for slot in slots
            )
            weeks.append(ResourceWeek(member, rules, start, end, slots, hours))
    return weeks


def _allocated_hours_by_resource(
    organization=None, week_start=None, week_end=None
) -> dict[Any, float]:
    """Allocated hours per resource in one explicit window (kept for the resolve service)."""
    hours: dict[Any, float] = {}
    for slot in _week_slots(organization, week_start, week_end):
        hours[slot.resource_id] = hours.get(slot.resource_id, 0.0) + _overlap_hours(
            slot.start_time, slot.end_time, week_start, week_end
        )
    return hours


def get_capacity_summary(organization=None) -> list[dict[str, Any]]:
    """Per-department capacity summary for the current week (frontend shape).

    Platform-global: ``organization`` is ignored. Each resource's week is the one of its work
    calendar's time zone.
    """
    groups: dict[str, dict[str, Any]] = {}
    for week in resource_weeks():
        resource = week.resource
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
        allocated = round(week.hours, 2)
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


REDACTED_TITLE = "Booked on another project"


def _slot_project_id(slot) -> Any:
    """The project a booking belongs to (through its event, else its task), or None."""
    if slot.event is not None and slot.event.project_id is not None:
        return slot.event.project_id
    if slot.task is not None:
        return getattr(slot.task, "project_id", None)
    return None


def visible_slots(queryset, visible_project_ids):
    """
    Narrow bookings to those the caller may see.

    ``visible_project_ids`` is ``None`` for no restriction (platform admins), else the
    project ids the caller belongs to. A booking is visible when it belongs to no
    project (studio-wide) or to one of those projects.
    """
    if visible_project_ids is None:
        return queryset
    from django.db.models import Q

    other_project = (
        Q(event__project__isnull=False) & ~Q(event__project_id__in=visible_project_ids)
    ) | (Q(task__project__isnull=False) & ~Q(task__project_id__in=visible_project_ids))
    return queryset.exclude(other_project)


def _conflicting_event(slot, visible_project_ids=None) -> dict[str, Any]:
    project_id = _slot_project_id(slot)
    if (
        visible_project_ids is not None
        and project_id is not None
        and project_id not in visible_project_ids
    ):
        # Counts toward the excess, but nothing says what it is or whose it is.
        return {
            "id": str(slot.id),
            "title": REDACTED_TITLE,
            "project_code": None,
            "event_type": "meeting",
            "hours": 0.0,
        }
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


def get_overbooking_alerts(organization=None, visible_project_ids=None) -> list[dict[str, Any]]:
    """
    Overbooking alerts for resources exceeding weekly capacity (global).

    Hours always count every booking, so the excess is true. The bookings listed under
    an alert are limited to ``visible_project_ids`` (``None``: all); the others appear
    as anonymous entries. The week is the current one in each resource's calendar zone and the
    alert's ``date`` is that week's Monday there.
    """
    alerts = []
    for week in resource_weeks():
        resource = week.resource
        allocated = round(week.hours, 2)
        capacity = resource.capacity_hours_per_week
        if allocated <= capacity:
            continue
        excess = round(allocated - capacity, 2)
        conflicting = []
        for slot in week.slots:
            entry = _conflicting_event(slot, visible_project_ids)
            entry["hours"] = round(
                _overlap_hours(slot.start_time, slot.end_time, week.start, week.end), 2
            )
            conflicting.append(entry)
        alerts.append(
            {
                "id": f"ob-{resource.id}-{week.day:%Y%m%d}",
                "resource_id": str(resource.id),
                "resource_name": resource.name,
                "resource_type": RESOURCE_TYPE_MAP.get(resource.resource_type, "equipment"),
                "department": resource.department.name if resource.department else None,
                "date": week.day.isoformat(),
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
