"""
Capacity / overbooking aggregation selectors.

Computes the frontend `SchedulingCapacitySummary[]` and
`SchedulingOverbookingAlert[]` shapes from real `Resource` /
`ResourceSchedule` rows. The aggregation window is the current calendar week
of each resource: Monday 00:00 to the next Monday 00:00 in the time zone of the
work calendar the resource follows (docs/scheduling/CONTRACTS.md section 1); a
resource with no calendar follows the default one, which is UTC out of the box.
Slots partially overlapping the window contribute only their overlapping hours.
Only `Booked`/`Overbooked` slots consume capacity. A resource's capacity for the week is its weekly
figure scaled by the share of the calendar's usual working days that are still available: holidays
of its calendar (non-optional) and days covered by its approved leave take days away
(``week_capacity_hours``).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from django.utils import timezone

from apps.scheduling.domain.calendar import (
    DEFAULT_RULES,
    CalendarRules,
    week_bounds,
    week_bounds_for_date,
    week_capacity_hours,
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
    """One resource's week: the calendar it follows, the window, the bookings and the capacity."""

    resource: Any
    rules: CalendarRules
    start: datetime
    end: datetime
    slots: list[Any]
    hours: float
    #: the resource's weekly hours after holidays and approved leave are taken out
    capacity: float = 0.0

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


def _leave_days_by_resource(resource_ids: list[Any], monday: date) -> dict[Any, set[date]]:
    """The dates of the week from ``monday`` that approved leave covers, per resource."""
    from apps.scheduling.models import ResourceLeave

    sunday = monday + timedelta(days=6)
    days: dict[Any, set[date]] = {}
    leaves = ResourceLeave.objects.filter(
        resource_id__in=resource_ids,
        status="Approved",
        start_date__lte=sunday,
        end_date__gte=monday,
    ).values_list("resource_id", "start_date", "end_date")
    for resource_id, first, last in leaves:
        covered = days.setdefault(resource_id, set())
        day = max(first, monday)
        while day <= min(last, sunday):
            covered.add(day)
            day += timedelta(days=1)
    return days


def resource_weeks(
    *,
    now: datetime | None = None,
    week_day: date | None = None,
    resource_ids: list[Any] | None = None,
    department_id: Any = None,
    team_id: Any = None,
) -> list[ResourceWeek]:
    """
    Every resource with its own week window, allocated hours and capacity.

    Resources that follow the same rules share one window and one booking query; a studio on a
    single calendar costs the same as before. Holidays are read once per calendar and approved
    leave once per window. ``resource_ids``, ``department_id`` and ``team_id`` narrow the list.
    """
    from apps.scheduling.models import Resource

    now = now or timezone.now()
    default_calendar = CalendarSelector.default_calendar()
    default_rules = rules_of(default_calendar)
    queryset = Resource.objects.select_related("department", "calendar")
    if resource_ids is not None:
        queryset = queryset.filter(pk__in=resource_ids)
    if department_id is not None:
        queryset = queryset.filter(department_id=department_id)
    if team_id is not None:
        queryset = queryset.filter(team_id=team_id)
    groups: dict[CalendarRules, list[Any]] = {}
    calendars: dict[Any, Any] = {}
    for resource in queryset:
        own = resource.calendar
        calendar = default_calendar if own is None or own.is_deleted else own
        calendars[resource.pk] = calendar
        groups.setdefault(rules_of(calendar) if calendar else default_rules, []).append(resource)

    weeks: list[ResourceWeek] = []
    for rules, members in groups.items():
        start, end = (
            week_bounds_for_date(rules, week_day)
            if week_day is not None
            else week_bounds(rules, now)
        )
        monday = start.astimezone(rules.tz).date()
        sunday = monday + timedelta(days=6)
        slots_by_resource: dict[Any, list[Any]] = {}
        for slot in _slots_in(start, end, [member.id for member in members]):
            slots_by_resource.setdefault(slot.resource_id, []).append(slot)
        leave_days = _leave_days_by_resource([member.id for member in members], monday)
        holidays: dict[Any, set[date]] = {}
        for member in members:
            slots = slots_by_resource.get(member.id, [])
            hours = sum(
                _overlap_hours(slot.start_time, slot.end_time, start, end) for slot in slots
            )
            calendar = calendars[member.pk]
            key = calendar.pk if calendar is not None else None
            if key not in holidays:
                holidays[key] = CalendarSelector.holiday_dates(calendar, monday, sunday)
            capacity = week_capacity_hours(
                rules,
                monday,
                member.capacity_hours_per_week,
                holidays[key],
                leave_days.get(member.id, ()),
            )
            weeks.append(ResourceWeek(member, rules, start, end, slots, hours, float(capacity)))
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


def _plain_number(value: float) -> int | float:
    """A whole figure stays an integer (40, not 40.0), as the weekly figure always was."""
    rounded = round(value, 2)
    return int(rounded) if rounded == int(rounded) else rounded


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
                "total_capacity_hours": 0.0,
                "allocated_hours": 0.0,
                "overbooked_count": 0,
            },
        )
        allocated = round(week.hours, 2)
        group["total_resources"] += 1
        group["total_capacity_hours"] += week.capacity
        group["allocated_hours"] = round(group["allocated_hours"] + allocated, 2)
        if allocated > week.capacity:
            group["overbooked_count"] += 1

    summaries = []
    for group in groups.values():
        capacity = _plain_number(group["total_capacity_hours"])
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
        capacity = _plain_number(week.capacity)
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


def resource_week(resource: Any, *, week_day: date | None = None) -> ResourceWeek | None:
    """One resource's week (the current one, or the one containing ``week_day``), if it is live."""
    weeks = resource_weeks(resource_ids=[resource.pk], week_day=week_day)
    return weeks[0] if weeks else None


@dataclass(frozen=True)
class CapacityFigures:
    """Capacity of one or more resources for one week, after holidays and approved leave."""

    resources: int
    capacity_hours: float
    allocated_hours: float
    free_hours: float
    utilization_pct: float

    @classmethod
    def of(cls, weeks: list[ResourceWeek]) -> CapacityFigures:
        capacity = round(sum(week.capacity for week in weeks), 2)
        allocated = round(sum(week.hours for week in weeks), 2)
        return cls(
            resources=len(weeks),
            capacity_hours=capacity,
            allocated_hours=allocated,
            free_hours=round(max(capacity - allocated, 0), 2),
            utilization_pct=round(allocated / capacity * 100, 1) if capacity else 0.0,
        )


class CapacitySelector:
    """
    Public figures for other apps (Masterdata's utilization reads them through the
    ``scheduling.capacity`` provider). ``week_start`` is any local date in the week wanted, in the
    time zone of each resource's own calendar; ``None`` is the current week.
    """

    @staticmethod
    def resource_week(resource_id: Any, week_start: date | None = None) -> CapacityFigures:
        return CapacityFigures.of(resource_weeks(resource_ids=[resource_id], week_day=week_start))

    @staticmethod
    def department_week(department_id: Any, week_start: date | None = None) -> CapacityFigures:
        return CapacityFigures.of(resource_weeks(department_id=department_id, week_day=week_start))

    @staticmethod
    def team_week(team_id: Any, week_start: date | None = None) -> CapacityFigures:
        return CapacityFigures.of(resource_weeks(team_id=team_id, week_day=week_start))
