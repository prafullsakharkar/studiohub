"""
A resource's status as the API shows it (docs/scheduling/CONTRACTS.md DOM-SCH-03, decision Q33).

"On Leave" is not typed by anyone: it is shown while an Approved leave covers today's date in the
resource's work calendar. Otherwise a resource stored as "Unavailable" shows that, and anything
else shows "Active". The stored column is kept (nothing is dropped); an old "On Leave" value in it
is ignored when no leave backs it.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from django.utils import timezone

from apps.scheduling.domain.calendar import CalendarRules, local_date
from apps.scheduling.models import Resource, ResourceLeave
from apps.scheduling.selectors.calendar import CalendarSelector, rules_of

ON_LEAVE = Resource.STATUS_ON_LEAVE
ACTIVE = Resource.STATUS_ACTIVE
UNAVAILABLE = Resource.STATUS_UNAVAILABLE

#: the attribute a list selector fills (``current_leaves_prefetch``) to spare a query per row
PREFETCHED = "current_leaves"


def current_leaves_prefetch(now: datetime | None = None):
    """
    A ``Prefetch`` of the approved leave that could cover "today" in any time zone: local dates
    are within a day of the UTC date, so one window serves every calendar.
    """
    from django.db.models import Prefetch

    today = (now or timezone.now()).date()
    return Prefetch(
        "leaves",
        queryset=ResourceLeave.objects.filter(
            status=ResourceLeave.STATUS_APPROVED,
            start_date__lte=today + timedelta(days=1),
            end_date__gte=today - timedelta(days=1),
        ),
        to_attr=PREFETCHED,
    )


class ResourceStatusSelector:
    """Derives statuses for many resources, reading the default calendar only once."""

    def __init__(self, now: datetime | None = None) -> None:
        self.now = now or timezone.now()
        self._default: CalendarRules | None = None

    def _rules(self, resource: Any) -> CalendarRules:
        own = getattr(resource, "calendar", None)
        if own is not None and not own.is_deleted:
            return rules_of(own)
        if self._default is None:
            self._default = rules_of(CalendarSelector.default_calendar())
        return self._default

    def _covering_leave(self, resource: Any, today: date) -> bool:
        leaves = getattr(resource, PREFETCHED, None)
        if leaves is None:
            leaves = ResourceLeave.objects.filter(
                resource_id=resource.pk,
                status=ResourceLeave.STATUS_APPROVED,
                start_date__lte=today,
                end_date__gte=today,
            )
        return any(leave.start_date <= today <= leave.end_date for leave in leaves)

    def status_of(self, resource: Any) -> str:
        today = local_date(self._rules(resource), self.now)
        if self._covering_leave(resource, today):
            return ON_LEAVE
        return UNAVAILABLE if resource.status == UNAVAILABLE else ACTIVE
