"""
Capacity triage services.
"""

from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from django.core.exceptions import ValidationError as DjangoValidationError

from apps.scheduling.selectors.capacity import (
    _overlap_hours,
    _slots_in,
    resource_week,
    visible_slots,
    week_window_for,
)


def _parse_alert(alert_id: Any) -> tuple[str | None, Any]:
    """
    Parse an ``ob-<resource_uuid>-<yyyymmdd>`` alert id.

    Returns (resource_id, week_start_date); either may be None when the alert
    id is opaque/foreign (e.g. a mock id) — callers fall back to explicit
    parameters and the current week.
    """
    resource_id: str | None = None
    week_day: Any = None
    if isinstance(alert_id, str) and alert_id.startswith("ob-"):
        rest = alert_id[3:]
        if len(rest) > 9 and rest[-9] == "-" and rest[-8:].isdigit():
            candidate, stamp = rest[:-9], rest[-8:]
            try:
                UUID(candidate)
            except (ValueError, AttributeError, TypeError):
                candidate = ""
            if candidate:
                resource_id = candidate
                try:
                    week_day = date(int(stamp[0:4]), int(stamp[4:6]), int(stamp[6:8]))
                except ValueError:
                    week_day = None
    return resource_id, week_day


def resolve_overbooking(
    *,
    organization,
    alert_id: Any,
    resource_id: Any = None,
    visible_project_ids: Any = None,
) -> dict[str, Any] | None:
    """
    Triage an overbooking alert for real.

    Flags the resource's still-`Booked` slots in the alert week as
    `Overbooked` (the model's explicit triage state) so the board surfaces
    them for replanning, and reports the remaining excess. Returns None when
    the resource does not exist.

    Only bookings the caller may see are flagged (``visible_project_ids``: ``None`` for
    all, else the caller's project ids); bookings of other projects are left alone but
    still count toward the excess.
    """
    from apps.scheduling.models import Resource, ResourceSchedule

    parsed_id, week_day = _parse_alert(alert_id)
    target_id = resource_id or parsed_id
    if not target_id:
        raise DjangoValidationError("Unknown overbooking alert.")
    try:
        target_uuid = UUID(str(target_id))
    except (ValueError, AttributeError, TypeError):
        raise DjangoValidationError("Unknown overbooking alert.") from None

    resource = Resource.objects.filter(id=target_uuid).first()
    if resource is None:
        return None

    # The week is the one of the resource's work calendar (its time zone), the alert's own day
    # when it names one, else the current week.
    rules, week_start, week_end = week_window_for(resource, week_day=week_day)
    week_slots = _slots_in(week_start, week_end, [resource.id])
    allocated = round(
        sum(
            _overlap_hours(slot.start_time, slot.end_time, week_start, week_end)
            for slot in week_slots
        ),
        2,
    )
    # Capacity of that week: the weekly figure less the holidays and approved leave in it.
    week = resource_week(resource, week_day=week_day)
    capacity = week.capacity if week is not None else float(resource.capacity_hours_per_week)
    excess = round(allocated - capacity, 2)
    week_label = week_start.astimezone(rules.tz).date().isoformat()

    if excess <= 0:
        return {
            "success": True,
            "message": f"{resource.name} is already within capacity for the week of {week_label}.",
        }

    flagged = visible_slots(week_slots.filter(status="Booked"), visible_project_ids)
    flagged = ResourceSchedule.objects.filter(pk__in=flagged.values("pk")).update(
        status="Overbooked"
    )

    if flagged:
        message = (
            f"Flagged {flagged} booking(s) for {resource.name} as overbooked "
            f"for the week of {week_label}."
        )
        if excess > 0:
            message += f" {excess}h over capacity remains — reassign or extend the timeline."
        return {"success": True, "message": message}
    return {
        "success": True,
        "message": (
            f"Bookings for {resource.name} are already flagged; "
            f"{excess}h over capacity remains for the week of {week_label}."
        ),
    }
