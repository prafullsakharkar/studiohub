"""
Work calendars as the arithmetic sees them (docs/scheduling/CONTRACTS.md DOM-SCH-01, section 1).

The pure functions in ``apps.scheduling.domain.calendar`` take ``CalendarRules`` and a collection
of holiday dates. This selector turns a calendar row into the rules and reads its holidays. A
resource with no calendar follows the default calendar; when no default row exists (an emptied
database, a test that truncates every table) the built-in rules apply: UTC, Monday to Friday,
eight hours. An optional holiday does not remove a working day, so it is never passed.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from apps.scheduling.domain.calendar import DEFAULT_RULES, CalendarRules
from apps.scheduling.models import Holiday, WorkCalendar


def rules_of(calendar: WorkCalendar | None) -> CalendarRules:
    """The rules of ``calendar``; the built-in ones for ``None``."""
    if calendar is None:
        return DEFAULT_RULES
    weekdays = tuple(sorted(int(day) for day in calendar.working_weekdays)) or (
        DEFAULT_RULES.working_weekdays
    )
    return CalendarRules(
        time_zone=calendar.time_zone or DEFAULT_RULES.time_zone,
        working_weekdays=weekdays,
        hours_per_day=Decimal(calendar.hours_per_day),
    )


class CalendarSelector:
    @staticmethod
    def default_calendar() -> WorkCalendar | None:
        """The live default calendar, if there is one."""
        return WorkCalendar.objects.filter(is_default=True).first()

    @classmethod
    def calendar_for(cls, resource: Any) -> WorkCalendar | None:
        """The calendar ``resource`` follows: its own, else the default (``None``: built-in rules)."""
        own = getattr(resource, "calendar", None) if resource is not None else None
        if own is not None and not own.is_deleted:
            return own
        return cls.default_calendar()

    @classmethod
    def rules_for(cls, resource: Any) -> CalendarRules:
        return rules_of(cls.calendar_for(resource))

    @staticmethod
    def holiday_dates(calendar: WorkCalendar | None, start: date, end: date) -> set[date]:
        """Dates in ``start``..``end`` that remove a working day: the live, non-optional holidays."""
        if calendar is None:
            return set()
        return set(
            Holiday.objects.filter(
                calendar=calendar,
                is_optional=False,
                holiday_date__gte=start,
                holiday_date__lte=end,
            ).values_list("holiday_date", flat=True)
        )

    @classmethod
    def rules_and_holidays(
        cls, resource: Any, start: date, end: date
    ) -> tuple[CalendarRules, set[date]]:
        """The rules ``resource`` follows and the dates between ``start`` and ``end`` that are holidays."""
        calendar = cls.calendar_for(resource)
        return rules_of(calendar), cls.holiday_dates(calendar, start, end)
