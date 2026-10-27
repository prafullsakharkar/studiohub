"""
Scheduling migrations 0004 to 0007 on the test database.

* 0004 and 0005 seed the default calendar and attach every holiday, deleted ones included, to it;
  they reverse, and the way back refuses two calendars holding a holiday on one date.
* 0006 refuses, changing nothing, while a row would break a check or the resource-code rule, and
  names the rows. Deleted rows are included. Otherwise it adds the checks and reverses them.
* 0007 adds the milestone table and reverses it.
* 0008 (booking exclusion) refuses, changing nothing, while live bookings that occupy a resource
  overlap, names the pairs, and otherwise adds the constraint and reverses it.

Only the 0003 round trips drop columns (PostgreSQL never reuses their slots), so there are few.
The database is returned to the latest migration even when a test fails.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from django.db.utils import IntegrityError

from apps.scheduling.tests.migration_helpers import (
    clear_scheduling,
    columns,
    constraint_names,
    migrate,
    restore_latest,  # noqa: F401  (a fixture, used through the mark below)
    tables,
)

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("restore_latest"),
]

AT_0003 = [("scheduling", "0003_leave_rejected_by")]
AT_0004 = [("scheduling", "0004_work_calendar")]
AT_0005 = [("scheduling", "0005_holiday_calendar")]
AT_0006 = [("scheduling", "0006_checks_protect")]
AT_0007 = [("scheduling", "0007_milestone")]
AT_0008 = [("scheduling", "0008_booking_exclusion")]

NINE = datetime(2026, 11, 2, 9, tzinfo=UTC)
TEN = datetime(2026, 11, 2, 10, tzinfo=UTC)


def _resource(apps, code="R1", **extra):
    return apps.get_model("scheduling", "Resource").objects.create(
        name=f"Resource {code}", code=code, resource_type="Person", **extra
    )


def _studio(apps):
    """The default calendar; a transaction=True test elsewhere may have flushed the seeded one."""
    return apps.get_model("scheduling", "WorkCalendar").objects.get_or_create(
        code="STUDIO", defaults={"name": "Studio", "time_zone": "UTC", "is_default": True}
    )[0]


def _holiday(apps, day, **extra):
    return apps.get_model("scheduling", "Holiday").objects.create(
        name="Holiday", holiday_date=day, **extra
    )


class TestCalendarsAndHolidays:
    def test_it_seeds_the_default_calendar_attaches_every_holiday_and_reverses(self):
        apps = migrate(AT_0003)
        live = _holiday(apps, date(2026, 12, 25))
        gone = _holiday(apps, date(2026, 12, 26), is_deleted=True)
        resource = _resource(apps)
        assert "scheduling_work_calendar" not in tables()
        assert "calendar_id" not in columns("scheduling_holiday")

        apps = migrate(AT_0005)

        Calendar = apps.get_model("scheduling", "WorkCalendar")
        (default,) = Calendar._base_manager.filter(is_default=True)
        assert default.code == "STUDIO" and default.time_zone == "UTC"
        assert default.working_weekdays == [1, 2, 3, 4, 5] and default.hours_per_day == 8
        Holiday = apps.get_model("scheduling", "Holiday")
        assert Holiday._base_manager.get(pk=live.pk).calendar_id == default.pk
        assert Holiday._base_manager.get(pk=gone.pk).calendar_id == default.pk
        assert apps.get_model("scheduling", "Resource").objects.get(pk=resource.pk).calendar is None
        assert "scheduling_holiday_calendar_date_live_uniq" in constraint_names(
            "scheduling_holiday"
        )
        assert "scheduling_calendar_ucode_uniq" in constraint_names("scheduling_work_calendar")

        back = migrate(AT_0003)

        assert "scheduling_work_calendar" not in tables()
        assert "calendar_id" not in columns("scheduling_holiday")
        assert "calendar_id" not in columns("scheduling_resource")
        assert back.get_model("scheduling", "Holiday").objects.filter(pk=live.pk).exists()
        assert back.get_model("scheduling", "Resource").objects.filter(pk=resource.pk).exists()

    def test_a_deleted_holiday_does_not_block_the_same_date_in_the_same_calendar(self):
        apps = migrate(AT_0005)
        calendar = _studio(apps)
        _holiday(apps, date(2026, 12, 25), calendar=calendar, is_deleted=True)

        _holiday(apps, date(2026, 12, 25), calendar=calendar)  # one live holiday is fine

        with pytest.raises(IntegrityError):
            _holiday(apps, date(2026, 12, 25), calendar=calendar)

    def test_going_back_refuses_two_calendars_holding_a_holiday_on_one_date(self):
        apps = migrate(AT_0005)
        Calendar = apps.get_model("scheduling", "WorkCalendar")
        studio = _studio(apps)
        other = Calendar.objects.create(code="OTHER", name="Other", time_zone="UTC")
        _holiday(apps, date(2026, 12, 25), calendar=studio)
        _holiday(apps, date(2026, 12, 25), calendar=other)

        with pytest.raises(IntegrityError):
            migrate(AT_0004)

        assert "calendar_id" in columns("scheduling_holiday")  # the failed step rolled back


class TestTheChecks:
    @staticmethod
    def _bad_event(apps):
        return apps.get_model("scheduling", "CalendarEvent").objects.create(
            title="Backwards", start_time=TEN, end_time=NINE
        )

    @staticmethod
    def _bad_deleted_event(apps):
        return apps.get_model("scheduling", "CalendarEvent").objects.create(
            title="Backwards", start_time=TEN, end_time=NINE, is_deleted=True
        )

    @staticmethod
    def _bad_booking(apps):
        return apps.get_model("scheduling", "ResourceSchedule").objects.create(
            resource=_resource(apps), start_time=NINE, end_time=NINE, status="Booked"
        )

    @staticmethod
    def _bad_leave(apps):
        return apps.get_model("scheduling", "ResourceLeave").objects.create(
            resource=_resource(apps),
            leave_type="Vacation",
            start_date=date(2026, 9, 5),
            end_date=date(2026, 9, 1),
            total_days=1,
        )

    @staticmethod
    def _bad_rate(apps):
        return _resource(apps, hourly_rate_usd=-1)

    @pytest.mark.parametrize(
        ("make", "words"),
        [
            (_bad_event, "events that end before they start"),
            (_bad_deleted_event, "events that end before they start"),
            (_bad_booking, "bookings that do not end after they start"),
            (_bad_leave, "leave that ends before it starts"),
            (_bad_rate, "resources with a negative hourly rate"),
        ],
        ids=["event", "deleted-event", "booking", "leave", "rate"],
    )
    def test_it_refuses_a_row_that_breaks_a_check_and_names_it(self, make, words):
        apps = migrate(AT_0005)
        row = make.__func__(apps)

        with pytest.raises(RuntimeError) as error:
            migrate(AT_0006)

        message = str(error.value)
        assert "scheduling 0006 stopped, nothing was changed" in message
        assert words in message and str(row.pk) in message
        assert "scheduling_resource_ucode_uniq" not in constraint_names("scheduling_resource")
        assert "scheduling_event_end_not_before_start" not in constraint_names(
            "scheduling_calendar_event"
        )

    def test_it_refuses_resource_codes_that_differ_only_in_case_and_names_both(self):
        apps = migrate(AT_0005)
        first = _resource(apps, "abc-1")
        second = _resource(apps, "ABC-1")
        _resource(apps, "fine")

        with pytest.raises(RuntimeError) as error:
            migrate(AT_0006)

        message = str(error.value)
        assert "resource code ABC-1 is used more than once" in message
        assert str(first.pk) in message and str(second.pk) in message
        assert "fine" not in message

    def test_with_good_rows_it_applies_keeps_them_and_reverses(self):
        apps = migrate(AT_0005)
        resource = _resource(apps, "keep")
        apps.get_model("scheduling", "ResourceSchedule").objects.create(
            resource=resource, start_time=NINE, end_time=TEN, status="Booked"
        )
        apps.get_model("scheduling", "CalendarEvent").objects.create(
            title="Point", start_time=NINE, end_time=NINE
        )

        applied = migrate(AT_0006)

        assert {"scheduling_booking_end_after_start"} <= constraint_names(
            "scheduling_resource_schedule"
        )
        assert {"scheduling_event_end_not_before_start"} <= constraint_names(
            "scheduling_calendar_event"
        )
        assert {"scheduling_leave_end_not_before_start"} <= constraint_names(
            "scheduling_resource_leave"
        )
        assert {"scheduling_resource_ucode_uniq", "scheduling_resource_rate_not_negative"} <= (
            constraint_names("scheduling_resource")
        )
        assert applied.get_model("scheduling", "ResourceSchedule").objects.count() == 1

        back = migrate(AT_0005)

        assert "scheduling_booking_end_after_start" not in constraint_names(
            "scheduling_resource_schedule"
        )
        assert back.get_model("scheduling", "Resource").objects.filter(code="keep").exists()

    def test_the_checks_are_enforced_once_applied(self):
        apps = migrate(AT_0006)
        resource = _resource(apps, "enforced")

        with pytest.raises(IntegrityError):
            apps.get_model("scheduling", "ResourceSchedule").objects.create(
                resource=resource, start_time=NINE, end_time=NINE, status="Booked"
            )
        with pytest.raises(IntegrityError):
            _resource(apps, "ENFORCED")

    def test_a_resource_with_bookings_cannot_be_hard_deleted_after_the_migration(self):
        from django.db.models import ProtectedError

        apps = migrate(AT_0006)
        resource = _resource(apps, "protected")
        apps.get_model("scheduling", "ResourceSchedule").objects.create(
            resource=resource, start_time=NINE, end_time=TEN, status="Booked"
        )

        with pytest.raises(ProtectedError):
            resource.delete()


class TestMilestones:
    def test_the_table_comes_and_goes_with_the_migration(self):
        migrate(AT_0006)
        assert "scheduling_milestone" not in tables()

        migrate(AT_0007)

        assert "scheduling_milestone" in tables()
        assert {
            "scheduling_milestone_project_uname_live_uniq",
            "scheduling_milestone_delivery_needs_package",
            "scheduling_milestone_completed_has_time",
        } <= constraint_names("scheduling_milestone")

        migrate(AT_0006)
        assert "scheduling_milestone" not in tables()


class TestBookingExclusion:
    @staticmethod
    def _booking(apps, resource, first, last, status="Booked", **extra):
        return apps.get_model("scheduling", "ResourceSchedule").objects.create(
            resource=resource,
            start_time=datetime(2026, 11, 2, first, tzinfo=UTC),
            end_time=datetime(2026, 11, 2, last, tzinfo=UTC),
            status=status,
            **extra,
        )

    def test_it_refuses_overlapping_pairs_and_names_them(self):
        apps = migrate(AT_0007)
        resource = _resource(apps, "pair")
        first = self._booking(apps, resource, 9, 12)
        second = self._booking(apps, resource, 11, 14, status="Blocked")

        with pytest.raises(RuntimeError) as error:
            migrate(AT_0008)

        message = str(error.value)
        assert "scheduling 0008 stopped, nothing was changed" in message
        assert "resource pair" in message and str(first.pk) in message and str(second.pk) in message
        assert "scheduling_booking_no_overlap" not in constraint_names(
            "scheduling_resource_schedule"
        )

    def test_rows_that_cannot_conflict_do_not_stop_it(self):
        apps = migrate(AT_0007)
        resource = _resource(apps, "fine")
        self._booking(apps, resource, 9, 12)
        self._booking(apps, resource, 12, 14)  # adjacent
        self._booking(apps, resource, 10, 11, status="Available")  # never occupies
        self._booking(apps, resource, 10, 11, is_deleted=True)  # deleted
        self._booking(apps, _resource(apps, "other"), 9, 12)  # another resource

        migrate(AT_0008)

        assert "scheduling_booking_no_overlap" in constraint_names("scheduling_resource_schedule")

    def test_it_applies_keeping_the_rows_and_reverses_leaving_the_extension(self):
        from django.db import connection

        apps = migrate(AT_0007)
        resource = _resource(apps, "keep-b")
        self._booking(apps, resource, 9, 12)

        applied = migrate(AT_0008)
        assert applied.get_model("scheduling", "ResourceSchedule").objects.count() == 1
        with pytest.raises(IntegrityError):
            self._booking(
                applied, applied.get_model("scheduling", "Resource").objects.get(), 10, 11
            )

        back = migrate(AT_0007)

        assert "scheduling_booking_no_overlap" not in constraint_names(
            "scheduling_resource_schedule"
        )
        assert back.get_model("scheduling", "ResourceSchedule").objects.count() == 1
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_extension WHERE extname = 'btree_gist'")
            assert cursor.fetchone() is not None  # other objects may rely on it


def test_nothing_is_pending_after_the_chain():
    """The fixture's last step: clearing then migrating forward leaves no model change unmade."""
    clear_scheduling()
    migrate(AT_0008)
