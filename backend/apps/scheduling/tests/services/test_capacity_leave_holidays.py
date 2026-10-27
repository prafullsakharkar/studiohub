"""
Capacity after holidays and approved leave (docs/scheduling/CONTRACTS.md DOM-SCH-03, API-SCH-12).

The clock is frozen on Wednesday 4 November 2026, 12:00 UTC. That week is Monday 2 to Sunday 8
November. A resource's capacity is its weekly figure scaled by the share of the usual working days
that are still available.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from django.utils import timezone

from apps.core import providers
from apps.masterdata.models import Department, Team
from apps.scheduling.models import Holiday, ResourceLeave, ResourceSchedule
from apps.scheduling.selectors.capacity import (
    CapacitySelector,
    get_capacity_summary,
    get_overbooking_alerts,
    resource_week,
)
from apps.scheduling.services.capacity import resolve_overbooking
from apps.scheduling.tests.helpers import default_calendar, make_calendar, make_resource

pytestmark = pytest.mark.django_db

FROZEN = datetime(2026, 11, 4, 12, 0, tzinfo=UTC)
MONDAY = date(2026, 11, 2)


@pytest.fixture(autouse=True)
def frozen_clock(monkeypatch):
    monkeypatch.setattr(timezone, "now", lambda: FROZEN)


@pytest.fixture
def studio():
    return default_calendar()


def _holiday(calendar, day, **fields):
    return Holiday.objects.create(name="Holiday", holiday_date=day, calendar=calendar, **fields)


def _leave(resource, first, last, status="Approved"):
    return ResourceLeave.objects.create(
        resource=resource,
        leave_type="Vacation",
        start_date=first,
        end_date=last,
        total_days=1,
        status=status,
    )


def _book(resource, hours, day=2, status="Booked"):
    """``hours`` hours on one day of the week (day-of-November), from 00:00 UTC."""
    start = datetime(2026, 11, day, 0, tzinfo=UTC)
    end = datetime(2026, 11, day, hours, tzinfo=UTC)
    return ResourceSchedule.objects.create(
        resource=resource, start_time=start, end_time=end, status=status
    )


def _capacity(resource) -> float:
    week = resource_week(resource)
    assert week is not None
    return week.capacity


class TestHolidays:
    def test_an_ordinary_week_keeps_the_weekly_figure(self, studio):
        assert _capacity(make_resource(capacity_hours_per_week=40)) == 40
        assert _capacity(make_resource(capacity_hours_per_week=45)) == 45

    def test_a_holiday_takes_a_fifth_off(self, studio):
        _holiday(studio, date(2026, 11, 4))

        assert _capacity(make_resource(capacity_hours_per_week=40)) == 32
        assert _capacity(make_resource(capacity_hours_per_week=20)) == 16

    def test_an_optional_holiday_does_not(self, studio):
        _holiday(studio, date(2026, 11, 4), is_optional=True)

        assert _capacity(make_resource(capacity_hours_per_week=40)) == 40

    def test_a_deleted_holiday_does_not(self, studio):
        _holiday(studio, date(2026, 11, 4)).soft_delete()

        assert _capacity(make_resource(capacity_hours_per_week=40)) == 40

    def test_a_holiday_in_another_week_does_not(self, studio):
        _holiday(studio, date(2026, 11, 11))
        _holiday(studio, date(2026, 10, 28))

        assert _capacity(make_resource(capacity_hours_per_week=40)) == 40

    def test_a_weekend_holiday_does_not(self, studio):
        _holiday(studio, date(2026, 11, 7))

        assert _capacity(make_resource(capacity_hours_per_week=40)) == 40

    def test_only_the_holidays_of_the_resources_own_calendar_count(self, studio):
        other = make_calendar(code="OTHER")
        _holiday(studio, date(2026, 11, 4))
        _holiday(other, date(2026, 11, 5))
        _holiday(other, date(2026, 11, 6))
        on_default = make_resource(capacity_hours_per_week=40)
        on_other = make_resource(capacity_hours_per_week=40, calendar=other)

        assert _capacity(on_default) == 32
        assert _capacity(on_other) == 24


class TestLeave:
    def test_approved_leave_takes_its_working_days_off(self, studio):
        resource = make_resource(capacity_hours_per_week=40)
        _leave(resource, date(2026, 11, 3), date(2026, 11, 4))

        assert _capacity(resource) == 24

    def test_leave_reaching_into_the_week_counts_only_the_days_in_it(self, studio):
        resource = make_resource(capacity_hours_per_week=40)
        _leave(resource, date(2026, 10, 28), date(2026, 11, 3))  # ends Tuesday of this week

        assert _capacity(resource) == 24  # Monday and Tuesday are gone

    def test_a_week_of_leave_has_no_capacity_and_any_booking_overbooks(self, studio):
        resource = make_resource(capacity_hours_per_week=40)
        _leave(resource, date(2026, 11, 1), date(2026, 11, 9))
        _book(resource, 4)

        (alert,) = get_overbooking_alerts()

        assert _capacity(resource) == 0
        assert alert["max_capacity_hours"] == 0 and alert["excess_hours"] == 4

    @pytest.mark.parametrize("status", ["Pending", "Rejected", "Cancelled"])
    def test_leave_not_approved_does_not_count(self, studio, status):
        resource = make_resource(capacity_hours_per_week=40)
        _leave(resource, date(2026, 11, 3), date(2026, 11, 4), status=status)

        assert _capacity(resource) == 40

    def test_deleted_leave_does_not_count(self, studio):
        resource = make_resource(capacity_hours_per_week=40)
        _leave(resource, date(2026, 11, 3), date(2026, 11, 4)).soft_delete()

        assert _capacity(resource) == 40

    def test_someone_elses_leave_does_not_count(self, studio):
        mine, theirs = make_resource(capacity_hours_per_week=40), make_resource()
        _leave(theirs, date(2026, 11, 3), date(2026, 11, 4))

        assert _capacity(mine) == 40

    def test_a_holiday_inside_leave_is_taken_off_once(self, studio):
        resource = make_resource(capacity_hours_per_week=40)
        _holiday(studio, date(2026, 11, 4))
        _leave(resource, date(2026, 11, 3), date(2026, 11, 4))

        assert _capacity(resource) == 24  # Tuesday and Wednesday, not three days


class TestReportsAndTriage:
    def test_a_booking_that_fits_an_ordinary_week_is_not_an_alert_but_does_once_a_holiday_lands(
        self, studio
    ):
        resource = make_resource(capacity_hours_per_week=40)
        for day in (2, 3, 4, 5):
            _book(resource, 9, day=day)  # 36 hours

        assert get_overbooking_alerts() == []  # 36 of 40

        _holiday(studio, date(2026, 11, 6))  # capacity drops to 32

        (alert,) = get_overbooking_alerts()
        assert alert["max_capacity_hours"] == 32 and alert["excess_hours"] == 4

    def test_the_summary_uses_the_reduced_capacity(self, studio):
        department = Department.objects.create(code="CP", name="Comp", department_type="creative")
        resource = make_resource(capacity_hours_per_week=40, department=department)
        _holiday(studio, date(2026, 11, 4))
        _book(resource, 8)

        (row,) = get_capacity_summary()

        assert row["total_capacity_hours"] == 32
        assert row["allocated_hours"] == 8 and row["free_hours"] == 24
        assert row["utilization_pct"] == 25.0

    def test_triage_flags_against_the_reduced_capacity(self, studio):
        resource = make_resource(capacity_hours_per_week=40)
        for day in (2, 3, 4, 5):
            _book(resource, 9, day=day)  # 36 hours
        alert_id = f"ob-{resource.pk}-20261102"

        within = resolve_overbooking(organization=None, alert_id=alert_id)
        assert within is not None and "within capacity" in within["message"]

        _holiday(studio, date(2026, 11, 6))  # 32 hours of capacity now
        flagged = resolve_overbooking(organization=None, alert_id=alert_id)

        assert flagged is not None
        assert (
            "Flagged 4 booking(s)" in flagged["message"]
            and "4.0h over capacity" in flagged["message"]
        )
        assert ResourceSchedule.objects.filter(status="Overbooked").count() == 4


class TestPublicFigures:
    def _staff(self, studio):
        department = Department.objects.create(code="FX", name="FX", department_type="technical")
        team = Team.objects.create(code="T1", name="Team 1", department=department)
        a = make_resource(capacity_hours_per_week=40, department=department, team=team)
        b = make_resource(capacity_hours_per_week=20, department=department)
        c = make_resource(capacity_hours_per_week=40)  # another department (none)
        _holiday(studio, date(2026, 11, 4))
        _leave(a, date(2026, 11, 2), date(2026, 11, 2))
        _book(a, 8)
        _book(b, 5, day=3)
        _book(c, 8)
        return department, team, a, b, c

    def test_department_figures_equal_a_hand_count(self, studio):
        department, _, *_ = self._staff(studio)

        figures = CapacitySelector.department_week(department.pk, MONDAY)

        # a: 40 * 3/5 = 24 (holiday and Monday leave out); b: 20 * 4/5 = 16
        assert figures.resources == 2
        assert figures.capacity_hours == 40
        assert figures.allocated_hours == 13
        assert figures.free_hours == 27 and figures.utilization_pct == 32.5

    def test_team_and_resource_figures(self, studio):
        _, team, a, *_ = self._staff(studio)

        assert CapacitySelector.team_week(team.pk, MONDAY).capacity_hours == 24
        one = CapacitySelector.resource_week(a.pk, MONDAY)
        assert (one.resources, one.capacity_hours, one.allocated_hours) == (1, 24, 8)

    def test_the_current_week_is_the_default_and_a_neighbouring_week_is_ordinary(self, studio):
        department, *_ = self._staff(studio)

        assert CapacitySelector.department_week(department.pk).capacity_hours == 40
        assert (
            CapacitySelector.department_week(department.pk, date(2026, 11, 9)).capacity_hours == 60
        )

    def test_nobody_in_the_group_gives_zeros(self, studio):
        figures = CapacitySelector.department_week(
            Department.objects.create(code="EM", name="Empty", department_type="technical").pk
        )

        assert (figures.resources, figures.capacity_hours, figures.utilization_pct) == (0, 0, 0.0)

    def test_scheduling_offers_the_selector_to_other_apps_by_name(self):
        assert providers.get("scheduling.capacity") is CapacitySelector
