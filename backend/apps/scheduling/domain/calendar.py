"""
Working-day arithmetic (docs/scheduling/CONTRACTS.md section 1).

Pure functions: no ORM, no Django, no clock. A calendar is described by ``CalendarRules`` (a time
zone, the ISO weekdays that are worked and the hours of a working day) and the holidays are passed
in by the caller as a collection of dates (a selector reads them; an optional holiday is not in it,
because it does not remove a working day).

* A **day** (leave, holiday, milestone) is a date in the calendar's time zone.
* A **week** is Monday 00:00 to the next Monday 00:00 in the calendar's time zone, returned as UTC
  instants. It is 167 or 169 hours long across a change of daylight saving time: the bounds come
  from ``zoneinfo``, never from a fixed offset.
"""

from __future__ import annotations

from collections.abc import Collection
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

_CENTS = Decimal("0.01")


@dataclass(frozen=True)
class CalendarRules:
    """What the arithmetic needs of a work calendar."""

    time_zone: str = "UTC"
    #: ISO weekdays that are worked: 1 is Monday, 7 is Sunday
    working_weekdays: tuple[int, ...] = (1, 2, 3, 4, 5)
    hours_per_day: Decimal = Decimal("8")

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.time_zone)


#: What applies when no calendar is configured: UTC, Monday to Friday, eight hours.
DEFAULT_RULES = CalendarRules()


def is_working_day(rules: CalendarRules, day: date, holidays: Collection[date] = ()) -> bool:
    """Whether ``day`` is worked: a working weekday that is not a (non-optional) holiday."""
    return day.isoweekday() in rules.working_weekdays and day not in holidays


def working_days(
    rules: CalendarRules, start: date, end: date, holidays: Collection[date] = ()
) -> int:
    """Working days from ``start`` to ``end``, both included; 0 when ``end`` is before ``start``."""
    if end < start:
        return 0
    return sum(
        1
        for offset in range((end - start).days + 1)
        if is_working_day(rules, start + timedelta(days=offset), holidays)
    )


def _require_aware(instant: datetime) -> None:
    if instant.tzinfo is None or instant.utcoffset() is None:
        raise ValueError("A moment needs a time zone (a naive date-time is refused).")


def local_date(rules: CalendarRules, instant: datetime) -> date:
    """The calendar day ``instant`` falls on in the calendar's time zone."""
    _require_aware(instant)
    return instant.astimezone(rules.tz).date()


def week_start_date(rules: CalendarRules, instant: datetime) -> date:
    """The Monday of the week ``instant`` falls in, as a date in the calendar's time zone."""
    day = local_date(rules, instant)
    return day - timedelta(days=day.weekday())


def week_bounds_for_date(rules: CalendarRules, day: date) -> tuple[datetime, datetime]:
    """``(start, end)`` in UTC of the week that contains the local date ``day`` (end exclusive)."""
    monday = day - timedelta(days=day.weekday())
    start = datetime.combine(monday, time.min, tzinfo=rules.tz)
    end = datetime.combine(monday + timedelta(days=7), time.min, tzinfo=rules.tz)
    return start.astimezone(UTC), end.astimezone(UTC)


def week_bounds(rules: CalendarRules, instant: datetime) -> tuple[datetime, datetime]:
    """``(start, end)`` in UTC of the week ``instant`` falls in, in the calendar's time zone."""
    return week_bounds_for_date(rules, local_date(rules, instant))


def _day_bounds(rules: CalendarRules, day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tzinfo=rules.tz)
    end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=rules.tz)
    return start.astimezone(UTC), end.astimezone(UTC)


def working_hours(
    rules: CalendarRules,
    start_utc: datetime,
    end_utc: datetime,
    holidays: Collection[date] = (),
) -> Decimal:
    """
    Working hours between two instants.

    Each worked day contributes ``hours_per_day`` times the share of that local day the interval
    covers. The share is measured against the real length of the day (23 or 25 hours when daylight
    saving changes), so a whole worked day is always exactly ``hours_per_day``.
    """
    _require_aware(start_utc)
    _require_aware(end_utc)
    if end_utc <= start_utc:
        return Decimal("0.00")
    total = Decimal(0)
    day = local_date(rules, start_utc)
    last = local_date(rules, end_utc)
    while day <= last:
        if is_working_day(rules, day, holidays):
            day_start, day_end = _day_bounds(rules, day)
            overlap = (min(end_utc, day_end) - max(start_utc, day_start)).total_seconds()
            if overlap > 0:
                share = Decimal(str(overlap)) / Decimal(str((day_end - day_start).total_seconds()))
                total += share * rules.hours_per_day
        day += timedelta(days=1)
    return total.quantize(_CENTS, rounding=ROUND_HALF_UP)
