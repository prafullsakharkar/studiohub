"""
A resource's capacity week is Monday to Monday in the time zone of its work calendar
(docs/scheduling/CONTRACTS.md section 1), not in UTC. The clock is frozen at Sunday 1 November 2026,
20:00 UTC, which is already Monday 2 November, 01:30 in Kolkata (UTC+5:30, no daylight saving).
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from django.utils import timezone

from apps.masterdata.models import Department
from apps.scheduling.models import ResourceSchedule
from apps.scheduling.selectors.capacity import (
    get_capacity_summary,
    get_overbooking_alerts,
    resource_weeks,
)
from apps.scheduling.tests.helpers import default_calendar, make_calendar, make_resource

pytestmark = pytest.mark.django_db

FROZEN = datetime(2026, 11, 1, 20, 0, tzinfo=UTC)


@pytest.fixture(autouse=True)
def frozen_clock(monkeypatch):
    monkeypatch.setattr(timezone, "now", lambda: FROZEN)


def _book(resource, start, end):
    return ResourceSchedule.objects.create(
        resource=resource, start_time=start, end_time=end, status="Booked"
    )


@pytest.fixture
def pair():
    """One resource on the UTC default calendar, one on a Kolkata calendar, each with 4h a week."""
    default_calendar()
    kolkata = make_calendar(code="BLR", time_zone="Asia/Kolkata")
    utc = make_resource("R-UTC", capacity_hours_per_week=4)
    india = make_resource("R-IST", capacity_hours_per_week=4, calendar=kolkata)
    return utc, india


class TestTheWindow:
    def test_each_resource_gets_the_week_of_its_own_zone(self, pair):
        utc, india = pair

        weeks = {week.resource.pk: week for week in resource_weeks()}

        assert weeks[utc.pk].start == datetime(2026, 10, 26, tzinfo=UTC)
        assert weeks[utc.pk].end == datetime(2026, 11, 2, tzinfo=UTC)
        assert weeks[india.pk].start == datetime(2026, 11, 1, 18, 30, tzinfo=UTC)
        assert weeks[india.pk].end == datetime(2026, 11, 8, 18, 30, tzinfo=UTC)
        assert weeks[utc.pk].day.isoformat() == "2026-10-26"
        assert weeks[india.pk].day.isoformat() == "2026-11-02"

    def test_a_booking_is_counted_in_the_week_its_resources_zone_puts_it_in(self, pair):
        utc, india = pair
        # 04:00 to 09:00 UTC on Monday 2 November: next week for UTC, this week for Kolkata.
        for resource in pair:
            _book(
                resource, datetime(2026, 11, 2, 4, tzinfo=UTC), datetime(2026, 11, 2, 9, tzinfo=UTC)
            )

        hours = {week.resource.pk: week.hours for week in resource_weeks()}

        assert hours[utc.pk] == 0
        assert hours[india.pk] == 5

    def test_a_booking_across_the_window_start_is_clipped_to_it(self, pair):
        utc, india = pair
        # 17:00 to 19:00 UTC on Sunday: all of it is this week for UTC, but Kolkata's week begins
        # at 18:30 UTC, so only the last half hour counts there.
        for resource in pair:
            _book(
                resource,
                datetime(2026, 11, 1, 17, tzinfo=UTC),
                datetime(2026, 11, 1, 19, tzinfo=UTC),
            )

        hours = {week.resource.pk: week.hours for week in resource_weeks()}

        assert hours[utc.pk] == 2
        assert hours[india.pk] == 0.5


class TestAlertsAndSummary:
    def test_the_alert_is_raised_in_the_zone_where_the_hours_fall_and_carries_the_local_monday(
        self, pair
    ):
        utc, india = pair
        for resource in pair:
            _book(
                resource, datetime(2026, 11, 2, 4, tzinfo=UTC), datetime(2026, 11, 2, 9, tzinfo=UTC)
            )

        alerts = get_overbooking_alerts()

        assert [alert["resource_id"] for alert in alerts] == [str(india.pk)]
        alert = alerts[0]
        assert alert["id"] == f"ob-{india.pk}-20261102"
        assert alert["date"] == "2026-11-02"
        assert alert["scheduled_hours"] == 5 and alert["excess_hours"] == 1
        assert alert["conflicting_events"][0]["hours"] == 5

    def test_a_utc_resource_keeps_the_utc_monday(self, pair):
        utc, _ = pair
        _book(utc, datetime(2026, 10, 27, 9, tzinfo=UTC), datetime(2026, 10, 27, 15, tzinfo=UTC))

        (alert,) = get_overbooking_alerts()

        assert alert["id"] == f"ob-{utc.pk}-20261026" and alert["date"] == "2026-10-26"

    def test_the_summary_adds_up_each_resources_own_week(self, pair):
        department = Department.objects.create(code="ZN", name="Zone", department_type="technical")
        for resource in pair:
            resource.department = department
            resource.save(update_fields=["department"])
            _book(
                resource, datetime(2026, 11, 2, 4, tzinfo=UTC), datetime(2026, 11, 2, 9, tzinfo=UTC)
            )

        (row,) = get_capacity_summary()

        assert row["total_resources"] == 2 and row["total_capacity_hours"] == 8
        assert row["allocated_hours"] == 5  # only the Kolkata resource has it in this week
        assert row["overbooked_count"] == 1

    def test_with_every_resource_on_the_default_calendar_nothing_changes(self):
        default_calendar()
        resource = make_resource("R-ONLY", capacity_hours_per_week=4)
        _book(
            resource, datetime(2026, 10, 27, 9, tzinfo=UTC), datetime(2026, 10, 27, 15, tzinfo=UTC)
        )

        (alert,) = get_overbooking_alerts()

        assert alert["date"] == "2026-10-26" and alert["scheduled_hours"] == 6
