"""
Leave counts working days (decision Q20): weekends the calendar does not work and its non-optional
holidays are not counted; the calendar is the one the resource follows (its own, else the default).
Rows counted in calendar days before this are not recomputed.

2026 dates: Tuesday 1 September, Friday 4, Saturday 5, Sunday 6, Monday 7, Wednesday 9.
"""

from __future__ import annotations

from datetime import date
from io import StringIO

import pytest
from django.core.management import call_command

from apps.scheduling.models import Holiday, ResourceLeave, WorkCalendar
from apps.scheduling.services.leave import count_leave_days, working_leave_days
from apps.scheduling.tests.helpers import (
    admin_client,
    default_calendar,
    make_calendar,
    make_resource,
)

pytestmark = pytest.mark.django_db

URL = "/api/v1/scheduling/leaves/"


def _request(client, resource, start, end, **extra):
    return client.post(
        URL,
        {
            "resource": str(resource.pk),
            "leave_type": "Vacation",
            "start_date": start,
            "end_date": end,
            "reason": "private reason",
            **extra,
        },
        format="json",
    )


def _holiday(calendar, day, **fields):
    return Holiday.objects.create(name="Holiday", holiday_date=day, calendar=calendar, **fields)


class TestNewRequestsCountWorkingDays:
    def test_a_week_with_a_weekend_inside(self):
        resource = make_resource()
        default_calendar()

        response = _request(admin_client(), resource, "2026-09-01", "2026-09-05")

        assert response.status_code == 201, response.content
        assert response.json()["total_days"] == 4  # Tue to Fri; Saturday is not worked

    def test_across_a_weekend(self):
        resource = make_resource()
        default_calendar()

        response = _request(admin_client(), resource, "2026-09-04", "2026-09-07")

        assert response.json()["total_days"] == 2  # Friday and Monday

    def test_a_weekend_only_counts_nothing_but_is_still_a_request(self):
        resource = make_resource()
        default_calendar()

        response = _request(admin_client(), resource, "2026-09-05", "2026-09-06")

        assert response.status_code == 201 and response.json()["total_days"] == 0

    def test_a_holiday_of_the_default_calendar_is_not_counted(self):
        resource = make_resource()
        _holiday(default_calendar(), date(2026, 9, 2))

        response = _request(admin_client(), resource, "2026-09-01", "2026-09-04")

        assert response.json()["total_days"] == 3  # Tue to Fri minus Wednesday

    def test_an_optional_holiday_does_not_remove_a_working_day(self):
        resource = make_resource()
        _holiday(default_calendar(), date(2026, 9, 2), is_optional=True)

        response = _request(admin_client(), resource, "2026-09-01", "2026-09-04")

        assert response.json()["total_days"] == 4

    def test_a_deleted_holiday_is_not_counted(self):
        resource = make_resource()
        holiday = _holiday(default_calendar(), date(2026, 9, 2))
        holiday.soft_delete()

        assert (
            _request(admin_client(), resource, "2026-09-01", "2026-09-04").json()["total_days"] == 4
        )

    def test_the_resources_own_calendar_decides_the_week(self):
        """A Sunday to Thursday week: Sunday 6 September is worked, Friday 11 is not."""
        calendar = make_calendar(working_weekdays=[7, 1, 2, 3, 4])
        resource = make_resource(calendar=calendar)

        response = _request(admin_client(), resource, "2026-09-06", "2026-09-12")

        assert response.json()["total_days"] == 5

    def test_the_holidays_of_the_resources_own_calendar_count_not_the_defaults(self):
        studio = default_calendar()
        other = make_calendar(code="OTHER")
        _holiday(studio, date(2026, 9, 2))  # the default's holiday
        _holiday(other, date(2026, 9, 3))  # the other calendar's holiday
        mine = make_resource(calendar=other)

        response = _request(admin_client(), mine, "2026-09-01", "2026-09-04")

        assert response.json()["total_days"] == 3  # only Thursday is lost

    def test_a_resource_with_no_calendar_follows_the_default(self):
        studio = default_calendar()
        WorkCalendar.objects.filter(pk=studio.pk).update(working_weekdays=[1, 2, 3])
        resource = make_resource()

        assert (
            _request(admin_client(), resource, "2026-09-01", "2026-09-04").json()["total_days"] == 2
        )

    def test_with_no_calendar_row_at_all_the_built_in_week_applies(self):
        WorkCalendar.all_objects.all().delete()
        resource = make_resource()

        assert working_leave_days(resource, date(2026, 9, 1), date(2026, 9, 5)) == 4
        assert working_leave_days(None, date(2026, 9, 4), date(2026, 9, 7)) == 2

    def test_a_request_can_leave_the_total_out_or_send_the_right_one_but_not_a_wrong_one(self):
        resource = make_resource()
        default_calendar()
        client = admin_client()

        right = _request(client, resource, "2026-09-01", "2026-09-05", total_days=4)
        wrong = _request(client, resource, "2026-09-01", "2026-09-05", total_days=5)

        assert right.status_code == 201
        assert wrong.status_code == 400 and "It is 4 for these dates" in wrong.content.decode()


class TestOldRowsAreNotRecomputed:
    def _old_leave(self):
        """Counted the old way: Tuesday 1 to Saturday 5 September is five calendar days."""
        return ResourceLeave.objects.create(
            resource=make_resource(),
            leave_type="Vacation",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 5),
            total_days=count_leave_days(date(2026, 9, 1), date(2026, 9, 5)),
            reason="family",
        )

    def test_the_old_count_is_five_calendar_days(self):
        assert self._old_leave().total_days == 5

    def test_an_edit_that_leaves_the_dates_alone_keeps_the_old_count(self):
        leave = self._old_leave()

        response = admin_client().patch(f"{URL}{leave.pk}/", {"reason": "changed"}, format="json")

        assert response.status_code == 200, response.content
        leave.refresh_from_db()
        assert leave.total_days == 5 and leave.reason == "changed"

    def test_a_put_of_what_was_read_is_accepted_and_keeps_the_count(self):
        leave = self._old_leave()
        client = admin_client()
        read = client.get(f"{URL}{leave.pk}/").json()

        response = client.put(f"{URL}{leave.pk}/", read, format="json")

        assert response.status_code == 200, response.content
        leave.refresh_from_db()
        assert leave.total_days == 5

    def test_a_different_total_on_an_old_row_is_refused(self):
        leave = self._old_leave()

        response = admin_client().patch(f"{URL}{leave.pk}/", {"total_days": 3}, format="json")

        assert (
            response.status_code == 400 and "It is 5 for these dates" in response.content.decode()
        )

    def test_changing_the_dates_counts_working_days_from_then_on(self):
        leave = self._old_leave()

        response = admin_client().patch(
            f"{URL}{leave.pk}/", {"end_date": "2026-09-10"}, format="json"
        )

        assert response.status_code == 200, response.content
        leave.refresh_from_db()
        assert leave.total_days == 8  # Tue 1 to Thu 10 September, weekends out


class TestTheReportCommand:
    def _run(self, *args) -> str:
        out = StringIO()
        call_command("report_leave_days", *args, stdout=out)
        return out.getvalue()

    def _leaves(self):
        match = ResourceLeave.objects.create(
            resource=make_resource("R-MATCH"),
            leave_type="Vacation",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 3),
            total_days=3,
            reason="secret reason",
        )
        differs = ResourceLeave.objects.create(
            resource=make_resource("R-DIFF"),
            leave_type="Vacation",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 5),
            total_days=5,
            status="Approved",
            reason="secret reason",
        )
        return match, differs

    def test_it_lists_only_the_rows_that_would_count_differently(self):
        match, differs = self._leaves()

        output = self._run()

        assert str(differs.pk) in output and str(match.pk) not in output
        assert "stored=5" in output and "working=4" in output
        assert "1 of 2 leave rows would count differently" in output

    def test_it_changes_nothing_and_prints_no_reasons(self):
        _, differs = self._leaves()
        before = list(ResourceLeave.objects.order_by("pk").values())

        output = self._run()

        assert list(ResourceLeave.objects.order_by("pk").values()) == before
        assert "secret reason" not in output

    def test_it_can_be_limited_to_a_status_and_a_number_of_rows(self):
        self._leaves()

        assert "0 of 1" in self._run("--status", "Pending")
        assert "1 of 1" in self._run("--status", "Approved")
        limited = self._run("--limit", "0")
        assert "and 1 more not listed" in limited
