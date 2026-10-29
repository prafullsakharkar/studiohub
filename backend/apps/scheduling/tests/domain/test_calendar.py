"""
Working-day arithmetic (docs/scheduling/CONTRACTS.md section 1): pure functions, no database.

2026 dates used: Mondays 2026-03-02, 03-23, 06-01, 09-07, 10-19, 10-26. Daylight saving changes on
Sunday 2026-03-08 and 2026-11-01 (Los Angeles) and on Sunday 2026-03-29 and 2026-10-25 (London).
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest

from apps.scheduling.domain.calendar import (
    DEFAULT_RULES,
    CalendarRules,
    is_working_day,
    local_date,
    week_bounds,
    week_bounds_for_date,
    week_start_date,
    working_days,
    working_hours,
)

LONDON = CalendarRules(time_zone="Europe/London")
LOS_ANGELES = CalendarRules(time_zone="America/Los_Angeles")
KOLKATA = CalendarRules(time_zone="Asia/Kolkata")
SUN_TO_THU = CalendarRules(working_weekdays=(7, 1, 2, 3, 4))
SEVEN_DAYS = CalendarRules(working_weekdays=(1, 2, 3, 4, 5, 6, 7))


def utc(*args) -> datetime:
    return datetime(*args, tzinfo=UTC)


class TestWorkingDays:
    def test_a_monday_to_friday_week_is_five_days(self):
        assert working_days(DEFAULT_RULES, date(2026, 9, 7), date(2026, 9, 11)) == 5

    def test_weekends_are_not_counted(self):
        # Fri 11 Sep to Mon 14 Sep: Friday and Monday
        assert working_days(DEFAULT_RULES, date(2026, 9, 11), date(2026, 9, 14)) == 2

    def test_a_whole_weekend_is_none(self):
        assert working_days(DEFAULT_RULES, date(2026, 9, 12), date(2026, 9, 13)) == 0

    def test_one_day_counts_when_it_is_worked(self):
        assert working_days(DEFAULT_RULES, date(2026, 9, 9), date(2026, 9, 9)) == 1
        assert working_days(DEFAULT_RULES, date(2026, 9, 12), date(2026, 9, 12)) == 0

    def test_an_end_before_the_start_is_zero(self):
        assert working_days(DEFAULT_RULES, date(2026, 9, 11), date(2026, 9, 7)) == 0

    def test_a_holiday_takes_a_working_day_away(self):
        holidays = {date(2026, 9, 9)}

        assert working_days(DEFAULT_RULES, date(2026, 9, 7), date(2026, 9, 11), holidays) == 4

    def test_a_holiday_on_a_weekend_changes_nothing(self):
        holidays = {date(2026, 9, 12)}

        assert working_days(DEFAULT_RULES, date(2026, 9, 7), date(2026, 9, 13), holidays) == 5

    def test_the_caller_decides_what_counts_as_a_holiday_so_an_optional_one_is_left_out(self):
        """Optional holidays are filtered out by the selector: they do not remove a working day."""
        optional_only: set[date] = (
            set()
        )  # what the selector passes when the only holiday is optional

        assert working_days(DEFAULT_RULES, date(2026, 9, 7), date(2026, 9, 11), optional_only) == 5

    def test_custom_working_weekdays(self):
        # Sunday to Thursday week
        assert working_days(SUN_TO_THU, date(2026, 9, 6), date(2026, 9, 12)) == 5
        assert is_working_day(SUN_TO_THU, date(2026, 9, 6))  # a Sunday
        assert not is_working_day(SUN_TO_THU, date(2026, 9, 11))  # a Friday

    def test_a_seven_day_week(self):
        assert working_days(SEVEN_DAYS, date(2026, 9, 7), date(2026, 9, 13)) == 7

    def test_a_long_range_across_months(self):
        # September 2026 has 22 weekdays
        assert working_days(DEFAULT_RULES, date(2026, 9, 1), date(2026, 9, 30)) == 22

    def test_is_working_day(self):
        assert is_working_day(DEFAULT_RULES, date(2026, 9, 7))
        assert not is_working_day(DEFAULT_RULES, date(2026, 9, 7), {date(2026, 9, 7)})
        assert not is_working_day(DEFAULT_RULES, date(2026, 9, 13))


class TestWeekBounds:
    def test_a_plain_week_in_utc(self):
        start, end = week_bounds(DEFAULT_RULES, utc(2026, 9, 9, 15, 30))

        assert (start, end) == (utc(2026, 9, 7), utc(2026, 9, 14))

    def test_the_bounds_are_utc_instants(self):
        start, end = week_bounds(LONDON, utc(2026, 9, 9, 12))

        assert start.utcoffset() == timedelta(0) and end.utcoffset() == timedelta(0)

    def test_monday_midnight_belongs_to_the_new_week_and_the_second_before_to_the_old_one(self):
        assert week_bounds(DEFAULT_RULES, utc(2026, 9, 14, 0, 0, 0))[0] == utc(2026, 9, 14)
        assert week_bounds(DEFAULT_RULES, utc(2026, 9, 13, 23, 59, 59))[0] == utc(2026, 9, 7)

    # -- Europe/London --------------------------------------------------------------

    def test_london_in_winter_is_utc(self):
        start, end = week_bounds(LONDON, utc(2026, 1, 14, 12))

        assert (start, end) == (utc(2026, 1, 12), utc(2026, 1, 19))

    def test_london_summer_weeks_start_an_hour_before_midnight_utc(self):
        start, end = week_bounds(LONDON, utc(2026, 7, 15, 12))

        assert (start, end) == (utc(2026, 7, 12, 23), utc(2026, 7, 19, 23))

    def test_london_spring_forward_week_is_167_hours(self):
        """Clocks go forward on Sunday 2026-03-29, so the week from Monday 03-23 is a hour short."""
        start, end = week_bounds(LONDON, utc(2026, 3, 25, 12))

        assert (start, end) == (utc(2026, 3, 23, 0), utc(2026, 3, 29, 23))
        assert end - start == timedelta(hours=167)

    def test_london_fall_back_week_is_169_hours(self):
        """Clocks go back on Sunday 2026-10-25: the week from Monday 10-19 has an extra hour."""
        start, end = week_bounds(LONDON, utc(2026, 10, 21, 12))

        assert (start, end) == (utc(2026, 10, 18, 23), utc(2026, 10, 26, 0))
        assert end - start == timedelta(hours=169)

    # -- America/Los_Angeles --------------------------------------------------------

    def test_los_angeles_spring_forward_week_is_167_hours(self):
        start, end = week_bounds(LOS_ANGELES, utc(2026, 3, 4, 12))

        assert (start, end) == (utc(2026, 3, 2, 8), utc(2026, 3, 9, 7))
        assert end - start == timedelta(hours=167)

    def test_los_angeles_fall_back_week_is_169_hours(self):
        start, end = week_bounds(LOS_ANGELES, utc(2026, 10, 28, 12))

        assert (start, end) == (utc(2026, 10, 26, 7), utc(2026, 11, 2, 8))
        assert end - start == timedelta(hours=169)

    def test_the_week_after_a_change_is_the_ordinary_168_hours_again(self):
        for rules, instant in ((LONDON, utc(2026, 4, 1, 12)), (LOS_ANGELES, utc(2026, 3, 11, 12))):
            start, end = week_bounds(rules, instant)
            assert end - start == timedelta(hours=168)

    def test_a_moment_late_on_sunday_evening_in_los_angeles_is_still_the_old_week(self):
        # Sunday 2026-09-13 20:00 in Los Angeles is Monday 2026-09-14 03:00 UTC
        start, _ = week_bounds(LOS_ANGELES, utc(2026, 9, 14, 3))

        assert start == utc(2026, 9, 7, 7)

    # -- Asia/Kolkata (no daylight saving, +05:30) ---------------------------------

    def test_kolkata_weeks_start_at_18_30_utc_on_sunday(self):
        start, end = week_bounds(KOLKATA, utc(2026, 6, 3, 12))

        assert (start, end) == (utc(2026, 5, 31, 18, 30), utc(2026, 6, 7, 18, 30))
        assert end - start == timedelta(hours=168)

    def test_kolkata_the_minute_before_and_at_the_boundary(self):
        assert week_bounds(KOLKATA, utc(2026, 6, 7, 18, 29))[0] == utc(2026, 5, 31, 18, 30)
        assert week_bounds(KOLKATA, utc(2026, 6, 7, 18, 30))[0] == utc(2026, 6, 7, 18, 30)

    # -- helpers --------------------------------------------------------------------

    def test_the_week_start_date_is_the_local_monday(self):
        assert week_start_date(KOLKATA, utc(2026, 6, 7, 18, 30)) == date(2026, 6, 8)
        assert week_start_date(KOLKATA, utc(2026, 6, 7, 18, 29)) == date(2026, 6, 1)

    def test_bounds_for_a_date_match_bounds_for_an_instant(self):
        assert week_bounds_for_date(LONDON, date(2026, 3, 25)) == week_bounds(
            LONDON, utc(2026, 3, 25, 12)
        )

    def test_local_date(self):
        assert local_date(KOLKATA, utc(2026, 6, 7, 20)) == date(2026, 6, 8)
        assert local_date(LOS_ANGELES, utc(2026, 6, 7, 3)) == date(2026, 6, 6)

    def test_a_naive_moment_is_refused(self):
        with pytest.raises(ValueError):
            week_bounds(DEFAULT_RULES, datetime(2026, 9, 9, 12))  # noqa: DTZ001


class TestWorkingHours:
    def test_a_whole_working_day_is_hours_per_day(self):
        assert working_hours(DEFAULT_RULES, utc(2026, 9, 7), utc(2026, 9, 8)) == Decimal("8.00")

    def test_half_a_day_is_half_the_hours(self):
        assert working_hours(DEFAULT_RULES, utc(2026, 9, 7), utc(2026, 9, 7, 12)) == Decimal("4.00")

    def test_a_working_week_is_five_days_of_hours(self):
        assert working_hours(DEFAULT_RULES, utc(2026, 9, 7), utc(2026, 9, 14)) == Decimal("40.00")

    def test_a_weekend_is_nothing(self):
        assert working_hours(DEFAULT_RULES, utc(2026, 9, 12), utc(2026, 9, 14)) == Decimal("0.00")

    def test_a_holiday_is_nothing(self):
        holidays = {date(2026, 9, 9)}

        assert working_hours(DEFAULT_RULES, utc(2026, 9, 7), utc(2026, 9, 14), holidays) == Decimal(
            "32.00"
        )

    def test_the_hours_per_day_of_the_calendar_are_used(self):
        rules = CalendarRules(hours_per_day=Decimal("7.5"))

        assert working_hours(rules, utc(2026, 9, 7), utc(2026, 9, 14)) == Decimal("37.50")

    def test_an_empty_or_backwards_interval_is_zero(self):
        assert working_hours(DEFAULT_RULES, utc(2026, 9, 7, 12), utc(2026, 9, 7, 12)) == 0
        assert working_hours(DEFAULT_RULES, utc(2026, 9, 8), utc(2026, 9, 7)) == 0

    def test_the_week_in_the_calendars_zone_not_utc(self):
        """Kolkata's working week starts Sunday 18:30 UTC; Monday 00:00-12:00 IST is 4 hours."""
        start, _ = week_bounds(KOLKATA, utc(2026, 6, 3, 12))

        assert working_hours(KOLKATA, start, start + timedelta(hours=12)) == Decimal("4.00")

    def test_a_whole_worked_day_is_exact_on_a_23_hour_day(self):
        """Sunday 2026-03-08 in Los Angeles has 23 hours; worked on Sundays it is still 8.00."""
        rules = CalendarRules(
            time_zone="America/Los_Angeles", working_weekdays=(7,), hours_per_day=Decimal("8")
        )
        start, end = utc(2026, 3, 8, 8), utc(2026, 3, 9, 7)
        assert end - start == timedelta(hours=23)

        assert working_hours(rules, start, end) == Decimal("8.00")

    def test_a_whole_worked_day_is_exact_on_a_25_hour_day(self):
        rules = CalendarRules(
            time_zone="America/Los_Angeles", working_weekdays=(7,), hours_per_day=Decimal("8")
        )
        start, end = utc(2026, 11, 1, 7), utc(2026, 11, 2, 8)
        assert end - start == timedelta(hours=25)

        assert working_hours(rules, start, end) == Decimal("8.00")

    def test_a_whole_dst_week_is_five_working_days_in_both_directions(self):
        for rules, instant in ((LONDON, utc(2026, 3, 25, 12)), (LONDON, utc(2026, 10, 21, 12)),
                               (LOS_ANGELES, utc(2026, 3, 4, 12)), (LOS_ANGELES, utc(2026, 10, 28, 12))):  # fmt: skip
            start, end = week_bounds(rules, instant)

            assert working_hours(rules, start, end) == Decimal("40.00")
