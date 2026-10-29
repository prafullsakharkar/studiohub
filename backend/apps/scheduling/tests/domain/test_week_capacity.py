"""Capacity of a week after holidays and leave (pure arithmetic, no database)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from apps.scheduling.domain.calendar import (
    CalendarRules,
    available_days,
    week_capacity_hours,
)

RULES = CalendarRules()  # UTC, Monday to Friday, 8h
MONDAY = date(2026, 11, 2)


def test_an_ordinary_week_has_five_available_days():
    assert available_days(RULES, MONDAY) == (5, 5)


def test_a_holiday_takes_a_day_away():
    assert available_days(RULES, MONDAY, holidays={date(2026, 11, 4)}) == (4, 5)


def test_a_holiday_on_a_weekend_takes_nothing():
    assert available_days(RULES, MONDAY, holidays={date(2026, 11, 7)}) == (5, 5)


def test_leave_takes_days_away_and_a_holiday_inside_leave_counts_once():
    leave = {date(2026, 11, 3), date(2026, 11, 4), date(2026, 11, 7)}  # last one is a Saturday

    assert available_days(RULES, MONDAY, holidays={date(2026, 11, 4)}, leave_days=leave) == (3, 5)


def test_a_week_of_leave_has_no_days():
    week = {date(2026, 11, day) for day in range(2, 7)}

    assert available_days(RULES, MONDAY, leave_days=week) == (0, 5)


def test_a_custom_week_is_counted_by_its_own_working_days():
    rules = CalendarRules(working_weekdays=(7, 1, 2, 3, 4))  # Sunday to Thursday

    assert available_days(rules, MONDAY) == (5, 5)
    assert available_days(rules, MONDAY, holidays={date(2026, 11, 8)}) == (4, 5)  # the Sunday


def test_capacity_is_the_weekly_figure_in_an_ordinary_week_whatever_it_is():
    for weekly in (40, 45, 20, 0):
        assert week_capacity_hours(RULES, MONDAY, weekly) == Decimal(weekly).quantize(
            Decimal("0.01")
        )


def test_capacity_scales_with_the_days_left():
    holiday = {date(2026, 11, 4)}

    assert week_capacity_hours(RULES, MONDAY, 40, holidays=holiday) == Decimal("32.00")
    assert week_capacity_hours(RULES, MONDAY, 20, holidays=holiday) == Decimal("16.00")  # part-time
    assert week_capacity_hours(RULES, MONDAY, 45, holidays=holiday) == Decimal("36.00")


def test_a_week_of_leave_has_no_capacity():
    week = {date(2026, 11, day) for day in range(2, 7)}

    assert week_capacity_hours(RULES, MONDAY, 40, leave_days=week) == Decimal("0.00")


def test_a_figure_that_does_not_divide_evenly_is_rounded_to_hundredths():
    assert week_capacity_hours(RULES, MONDAY, 37, holidays={date(2026, 11, 4)}) == Decimal("29.60")
    assert week_capacity_hours(
        RULES, MONDAY, 10, leave_days={date(2026, 11, 2)} | {date(2026, 11, 3)}
    ) == Decimal("6.00")
