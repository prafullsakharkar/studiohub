"""
What is recorded and what is kept out (docs/scheduling/CONTRACTS.md sections 6 and 7, SEC-SCH-05):

* leave decisions, overrides, calendar default changes and milestone completion are audit rows
  under the ``scheduling`` target, with ids, dates and statuses but never a reason, note or rate;
* the change log copies scheduling rows without leave reasons, booking notes, pay rates or event
  text;
* nothing in the application log contains them either.
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime

import pytest

from apps.audit.models import AuditLog, ChangeLog
from apps.scheduling.models import ResourceLeave, ResourceSchedule
from apps.scheduling.tests.helpers import (
    ALL_CODES,
    APPROVE,
    MANAGE,
    VIEW,
    client_for,
    default_calendar,
    make_calendar,
    make_resource,
    person,
)

pytestmark = pytest.mark.django_db

BASE = "/api/v1/scheduling/"
REASON = "kidney-surgery-xyzzy"
REJECTION = "no-cover-plugh"
NOTE = "client-call-quux"
RATE = "987.65"
SECRETS = (REASON, REJECTION, NOTE, RATE)


@pytest.fixture(autouse=True)
def calendar():
    return default_calendar()


def _leave(resource, status="Pending", **extra):
    return ResourceLeave.objects.create(
        resource=resource,
        leave_type="Vacation",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 3),
        total_days=3,
        reason=REASON,
        status=status,
        **extra,
    )


def _audit(target_id):
    return list(AuditLog.objects.filter(target_type="scheduling", target_id=str(target_id)))


def _blob(row) -> str:
    return f"{row.description} {row.target_name} {row.metadata}"


class TestAuditRows:
    def test_an_approval_is_recorded_without_the_reason(self):
        approver = person(VIEW, APPROVE)
        leave = _leave(make_resource(code="AUD1"))

        client_for(approver).post(f"{BASE}leaves/{leave.pk}/approve/")

        (row,) = _audit(leave.pk)
        assert row.actor_id == approver.pk and row.metadata["event"] == "leave.approved"
        assert row.metadata["resource"] == "AUD1" and row.metadata["overridden"] is False
        assert REASON not in _blob(row)

    def test_a_rejection_is_recorded_without_either_reason(self):
        leave = _leave(make_resource())

        client_for(person(VIEW, APPROVE)).post(
            f"{BASE}leaves/{leave.pk}/reject/", {"rejection_reason": REJECTION}, format="json"
        )

        (row,) = _audit(leave.pk)
        assert row.metadata["event"] == "leave.rejected"
        assert REJECTION not in _blob(row) and REASON not in _blob(row)

    def test_a_refused_decision_leaves_no_row(self):
        leave = _leave(make_resource(), status="Approved")

        client_for(person(VIEW, APPROVE)).post(f"{BASE}leaves/{leave.pk}/approve/")

        assert _audit(leave.pk) == []

    def test_changing_the_default_calendar_is_recorded_once(self):
        other = make_calendar(code="NEWDEF")
        api = client_for(person(VIEW, MANAGE))

        api.post(f"{BASE}calendars/{other.pk}/set-default/")
        api.post(f"{BASE}calendars/{other.pk}/set-default/")  # already the default: no change

        (row,) = _audit(other.pk)
        assert row.metadata["event"] == "calendar.default_changed"
        assert row.metadata["calendar"] == "NEWDEF"

    def test_completing_and_reopening_a_milestone_are_recorded(self):
        from apps.production.tests.factories import ProjectFactory
        from apps.scheduling.models import Milestone

        project = ProjectFactory.create(code="AUDM")
        milestone = Milestone.objects.create(
            project=project, name="Turnover", due_date=date(2026, 12, 1)
        )

        client_for(admin_user := person(superuser=True)).post(
            f"{BASE}milestones/{milestone.pk}/complete/"
        )
        client_for(admin_user).post(f"{BASE}milestones/{milestone.pk}/reopen/")

        events = [row.metadata["event"] for row in _audit(milestone.pk)]
        assert sorted(events) == ["milestone.completed", "milestone.reopened"]


class TestChangeLogMasking:
    @staticmethod
    def _rows(model_name):
        return list(ChangeLog.objects.filter(target_type=model_name))

    @staticmethod
    def _text(rows) -> str:
        return " ".join(f"{r.before_values} {r.after_values} {r.changed_fields}" for r in rows)

    def test_a_leave_is_logged_without_its_reasons(self):
        approver = person(VIEW, APPROVE)
        leave = _leave(make_resource())
        client_for(approver).post(
            f"{BASE}leaves/{leave.pk}/reject/", {"rejection_reason": REJECTION}, format="json"
        )

        rows = self._rows("ResourceLeave")

        assert rows, "the leave was not tracked at all"
        text = self._text(rows)
        assert REASON not in text and REJECTION not in text
        assert "status" in text  # the change itself is there

    def test_a_booking_is_logged_without_its_notes(self):
        resource = make_resource()
        ResourceSchedule.objects.create(
            resource=resource,
            start_time=datetime(2026, 11, 2, 9, tzinfo=UTC),
            end_time=datetime(2026, 11, 2, 10, tzinfo=UTC),
            status="Booked",
            notes=NOTE,
        )

        rows = self._rows("ResourceSchedule")

        assert rows and NOTE not in self._text(rows)

    def test_a_resource_is_logged_without_its_pay_rate(self):
        resource = make_resource(hourly_rate_usd=RATE)
        resource.name = "Renamed"
        resource.save()

        rows = self._rows("Resource")

        assert rows
        assert RATE not in self._text(rows) and "hourly_rate_usd" not in self._text(rows)
        assert "Renamed" in self._text(rows)

    def test_the_other_scheduling_models_are_tracked(self):
        from apps.scheduling.models import CalendarEvent, Holiday

        CalendarEvent.objects.create(
            title="Review",
            description=NOTE,
            start_time=datetime(2026, 11, 2, 9, tzinfo=UTC),
            end_time=datetime(2026, 11, 2, 10, tzinfo=UTC),
        )
        Holiday.objects.create(
            name="Diwali", holiday_date=date(2026, 11, 8), calendar=default_calendar()
        )
        make_calendar(code="TRK")

        assert self._rows("CalendarEvent") and NOTE not in self._text(self._rows("CalendarEvent"))
        assert self._rows("Holiday") and self._rows("WorkCalendar")


class TestTheApplicationLog:
    def test_requests_that_carry_private_text_leave_none_of_it_in_the_logs(self, caplog):
        caplog.set_level(logging.DEBUG)
        user = person(*ALL_CODES)
        resource = make_resource(user=user, hourly_rate_usd=RATE)
        api = client_for(user)

        leave = api.post(
            f"{BASE}leaves/",
            {
                "leave_type": "Vacation",
                "start_date": "2026-09-01",
                "end_date": "2026-09-03",
                "reason": REASON,
            },
            format="json",
        )
        booking = api.post(
            f"{BASE}schedules/",
            {
                "resource": str(resource.pk),
                "start_time": "2026-11-02T09:00:00Z",
                "end_time": "2026-11-02T10:00:00Z",
                "status": "Booked",
                "notes": NOTE,
            },
            format="json",
        )
        clash = api.post(
            f"{BASE}schedules/",
            {
                "resource": str(resource.pk),
                "start_time": "2026-11-02T09:30:00Z",
                "end_time": "2026-11-02T10:30:00Z",
                "status": "Booked",
                "notes": NOTE,
            },
            format="json",
        )
        decided = client_for(person(VIEW, APPROVE)).post(
            f"{BASE}leaves/{leave.json()['id']}/reject/",
            {"rejection_reason": REJECTION},
            format="json",
        )
        api.get(f"{BASE}resources/")
        api.post(
            f"{BASE}resources/",
            {"name": "New", "code": "LOGRES", "hourly_rate_usd": RATE},
            format="json",
        )

        assert leave.status_code == 201 and booking.status_code == 201
        assert clash.status_code == 409 and decided.status_code == 200
        for secret in SECRETS:
            assert secret not in caplog.text, f"{secret} reached the log"
