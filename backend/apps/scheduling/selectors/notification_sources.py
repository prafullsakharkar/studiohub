"""
What the in-app notifications read from scheduling (docs/review-pipeline RP-13, C-RP-34 to C-RP-36).

The notifications app never queries this app's models: it asks here who is involved in a milestone,
which milestones are due, whether a person may open one ("in reach"), and what to call it. Reach is
what ``GET scheduling/milestones/{id}/`` answers: ``schedule.view`` and the projects
``MilestoneSelector`` narrows to (full internal access; every project for a platform
administrator). Dates are the studio's: the time zone of the default work calendar, UTC without one.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, datetime, timedelta
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db.models import QuerySet
from django.utils import timezone

from apps.production.permissions.checks import has_permission_code
from apps.scheduling.constants.permissions import SchedulingPermissions
from apps.scheduling.models import Milestone
from apps.scheduling.selectors import MilestoneSelector
from apps.scheduling.selectors.calendar import CalendarSelector

MILESTONE = "milestone"

DUE = "due"
OVERDUE = "overdue"

#: an overdue milestone is reminded only if it fell due this many days ago or less (C-RP-36)
OVERDUE_WINDOW_DAYS = 7


def _uuids(values: Iterable[Any]) -> list[UUID]:
    found = []
    for value in values:
        try:
            found.append(UUID(str(value)))
        except (TypeError, ValueError):
            continue
    return found


def _sid(value: Any) -> str | None:
    return str(value) if value else None


class ScheduleNotificationSources:
    # ------------------------------------------------------------------ who is involved

    @staticmethod
    def milestone(milestone_id: Any) -> dict[str, Any] | None:
        """
        The live milestone ``milestone_id``: ``project_id``, ``created_by_id`` and, for a delivery
        milestone, ``delivery_id`` (else ``None``); ``None`` if it is gone.
        """
        ids = _uuids([milestone_id])
        row = (
            Milestone.objects.filter(pk=ids[0])
            .values("project_id", "created_by_id", "kind", "delivery_package_id")
            .first()
            if ids
            else None
        )
        if row is None:
            return None
        return {
            "project_id": str(row["project_id"]),
            "created_by_id": _sid(row["created_by_id"]),
            "delivery_id": _sid(row["delivery_package_id"])
            if row["kind"] == Milestone.KIND_DELIVERY
            else None,
        }

    @staticmethod
    def studio_today(now: datetime | None = None) -> date:
        """Today in the time zone of the studio's default work calendar (UTC without one)."""
        calendar = CalendarSelector.default_calendar()
        try:
            zone = ZoneInfo(calendar.time_zone) if calendar and calendar.time_zone else None
        except (ZoneInfoNotFoundError, ValueError):
            zone = None
        return timezone.localtime(now or timezone.now(), zone or ZoneInfo("UTC")).date()

    @staticmethod
    def reminders(today: date) -> list[dict[str, Any]]:
        """
        The milestones to remind on ``today`` (C-RP-36): live, not completed, of a live project, due
        today or tomorrow (stage ``due``) or in the last ``OVERDUE_WINDOW_DAYS`` days (``overdue``).
        Each is ``{"id", "project_id", "created_by_id", "delivery_id", "due_date", "stage"}``.
        """
        rows = (
            Milestone.objects.filter(
                due_date__gte=today - timedelta(days=OVERDUE_WINDOW_DAYS),
                due_date__lte=today + timedelta(days=1),
                project__is_deleted=False,
            )
            .exclude(status=Milestone.STATUS_COMPLETED)
            .order_by("due_date", "id")
            .values("pk", "project_id", "created_by_id", "kind", "delivery_package_id", "due_date")
        )
        return [
            {
                "id": str(row["pk"]),
                "project_id": str(row["project_id"]),
                "created_by_id": _sid(row["created_by_id"]),
                "delivery_id": _sid(row["delivery_package_id"])
                if row["kind"] == Milestone.KIND_DELIVERY
                else None,
                "due_date": row["due_date"].isoformat(),
                "stage": DUE if row["due_date"] >= today else OVERDUE,
            }
            for row in rows
        ]

    # ------------------------------------------------------------------ reach

    @staticmethod
    def readable_query(request: Any) -> QuerySet[Any]:
        """The ids of every live milestone the person of ``request`` may open, as a subquery."""
        user = getattr(request, "user", None)
        if (
            user is None
            or not getattr(user, "is_authenticated", False)
            or not getattr(user, "is_active", False)
            or not has_permission_code(request, SchedulingPermissions.VIEW)
        ):
            return Milestone.objects.none().values_list("pk", flat=True)
        return MilestoneSelector.get_queryset(request=request).values_list("pk", flat=True)

    # ------------------------------------------------------------------ labels

    @staticmethod
    def labels(ids: Iterable[Any]) -> dict[str, dict[str, Any]]:
        """``{id: {"code", "name", "record"}}`` of the live milestones ``ids``: the name, read now."""
        wanted = _uuids(ids)
        if not wanted:
            return {}
        rows = Milestone.objects.filter(pk__in=wanted).values_list("pk", "name")
        return {str(pk): {"code": "", "name": name, "record": None} for pk, name in rows}
