"""CR-25: the scheduling lists filter, event rows carry their project id, and the odd error bodies are objects."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta

import pytest

from apps.production.tests.factories import ProjectFactory
from apps.scheduling.models import CalendarEvent, Milestone, ResourceLeave, ResourceSchedule
from apps.scheduling.tests.helpers import (
    ALL_CODES,
    admin_client,
    client_for,
    make_calendar,
    make_resource,
    person,
)

pytestmark = pytest.mark.django_db

S = "/api/v1/scheduling/"
UNKNOWN = "00000000-0000-0000-0000-000000000000"


@pytest.fixture
def api():
    return client_for(person(*ALL_CODES))


def ids(api, path, **params):
    response = api.get(f"{S}{path}/", params)
    assert response.status_code == 200, response.content
    return {row["id"] for row in response.json()}


def at(day, hour=9):
    return datetime(2026, 11, day, hour, tzinfo=UTC)


def iso(day, hour=0):
    return at(day, hour).strftime("%Y-%m-%dT%H:%M:%SZ")


class TestResources:
    def test_type_status_department_and_calendar(self, api):
        calendar = make_calendar()
        person_a = make_resource(resource_type="Person", calendar=calendar)
        box = make_resource(resource_type="Equipment", status="Unavailable")
        assert ids(api, "resources", resource_type="equipment") == {str(box.pk)}
        assert ids(api, "resources", resource_type="Banana") == set()
        assert ids(api, "resources", status="unavailable") == {str(box.pk)}
        assert ids(api, "resources", status="Active") == {str(person_a.pk)}
        assert ids(api, "resources", calendar_id=str(calendar.pk)) == {str(person_a.pk)}
        assert ids(api, "resources", calendar=UNKNOWN) == set()
        assert ids(api, "resources", status="Banana") == set()

    def test_the_status_filter_follows_the_status_shown(self, api):
        today = datetime.now(UTC).date()
        away = make_resource()
        here = make_resource()
        ResourceLeave.objects.create(
            resource=away,
            start_date=today - timedelta(days=1),
            end_date=today + timedelta(days=1),
            status="Approved",
            leave_type="Vacation",
            total_days=3,
        )
        ResourceLeave.objects.create(
            resource=here,
            start_date=today,
            end_date=today,
            status="Pending",
            leave_type="Vacation",
            total_days=1,
        )
        assert ids(api, "resources", status="On Leave") == {str(away.pk)}
        assert ids(api, "resources", status="Active") == {
            str(here.pk)
        }  # pending leave does not take anyone off

    def test_a_value_that_is_not_an_id_is_400(self, api):
        assert api.get(f"{S}resources/", {"department_id": "nope"}).status_code == 400


class TestBookings:
    def test_resource_and_status(self, api):
        a, b = make_resource(), make_resource()
        booked = ResourceSchedule.objects.create(
            resource=a, start_time=at(2), end_time=at(2, 12), status="Booked"
        )
        blocked = ResourceSchedule.objects.create(
            resource=b, start_time=at(2), end_time=at(2, 12), status="Blocked"
        )
        assert ids(api, "schedules", resource=str(a.pk)) == {str(booked.pk)}
        assert ids(api, "schedules", resource_id=str(b.pk)) == {str(blocked.pk)}
        assert ids(api, "schedules", status="blocked") == {str(blocked.pk)}
        assert api.get(f"{S}schedules/", {"resource": "nope"}).status_code == 400

    def test_a_bad_window_is_an_object_naming_the_parameter(self, api):
        response = api.get(f"{S}schedules/", {"start": "yesterday"})
        assert response.status_code == 400
        assert "start" in response.json()
        response = api.get(f"{S}schedules/", {"end": "2026-11-02T00:00:00"})
        assert "end" in response.json()


class TestLeave:
    def test_status_type_resource_and_window(self, api):
        a, b = make_resource(), make_resource()
        vacation = ResourceLeave.objects.create(
            resource=a,
            start_date=date(2026, 12, 1),
            end_date=date(2026, 12, 5),
            status="Pending",
            leave_type="Vacation",
            total_days=5,
        )
        sick = ResourceLeave.objects.create(
            resource=b,
            start_date=date(2026, 12, 20),
            end_date=date(2026, 12, 22),
            status="Approved",
            leave_type="Sick Leave",
            total_days=3,
        )
        assert ids(api, "leaves", status="approved") == {str(sick.pk)}
        assert ids(api, "leaves", leave_type="vacation") == {str(vacation.pk)}
        assert ids(api, "leaves", resource=str(a.pk)) == {str(vacation.pk)}
        assert ids(api, "leaves", start="2026-12-10") == {str(sick.pk)}
        assert ids(api, "leaves", end="2026-12-10") == {str(vacation.pk)}
        assert ids(api, "leaves", start="2026-12-05", end="2026-12-20") == {
            str(vacation.pk),
            str(sick.pk),
        }  # touching the edge overlaps
        assert api.get(f"{S}leaves/", {"start": "soon"}).status_code == 400


class TestEvents:
    def test_the_row_carries_the_project_id(self):
        project = ProjectFactory.create(code="EVA")
        admin = admin_client()
        CalendarEvent.objects.create(
            title="Dailies",
            start_time=at(4, 10),
            end_time=at(4, 11),
            event_type="Meeting",
            status="Scheduled",
            visibility="Organization",
            project=project,
        )
        CalendarEvent.objects.create(
            title="Social",
            start_time=at(5, 10),
            end_time=at(5, 11),
            event_type="Meeting",
            status="Scheduled",
            visibility="Organization",
        )
        rows = {row["title"]: row for row in admin.get(f"{S}events/").json()}
        assert rows["Dailies"]["project_id"] == str(project.pk)
        assert rows["Social"]["project_id"] is None

    def test_project_type_status_visibility_and_window(self):
        project = ProjectFactory.create(code="EVB")
        admin = admin_client()
        a = CalendarEvent.objects.create(
            title="A",
            start_time=at(4, 10),
            end_time=at(4, 11),
            event_type="Meeting",
            status="Scheduled",
            visibility="Organization",
            project=project,
        )
        b = CalendarEvent.objects.create(
            title="B",
            start_time=at(9, 10),
            end_time=at(9, 11),
            event_type="Deadline",
            status="Completed",
            visibility="Public",
        )
        assert ids(admin, "events", project=str(project.pk)) == {str(a.pk)}
        assert ids(admin, "events", project_id=UNKNOWN) == set()
        assert ids(admin, "events", event_type="deadline") == {str(b.pk)}
        assert ids(admin, "events", status="COMPLETED") == {str(b.pk)}
        assert ids(admin, "events", visibility="public") == {str(b.pk)}
        assert ids(admin, "events", start=iso(5), end=iso(10)) == {str(b.pk)}
        assert ids(admin, "events", start=iso(4, 11)) == {
            str(b.pk)
        }  # touching the edge does not overlap
        assert admin.get(f"{S}events/", {"start": "2026-11-04T00:00:00"}).status_code == 400
        assert "start" in admin.get(f"{S}events/", {"start": "yesterday"}).json()


class TestMilestones:
    def test_status_kind_and_project_by_id_or_code(self, api):
        one, two = ProjectFactory.create(code="MSX"), ProjectFactory.create(code="MSY")
        admin = admin_client()
        a = Milestone.objects.create(
            project=one, name="A", due_date=date(2026, 12, 1), status="Pending", kind="general"
        )
        b = Milestone.objects.create(
            project=two,
            name="B",
            due_date=date(2026, 12, 2),
            status="Completed",
            completed_at=at(2),
            kind="delivery",
            delivery_package_id=uuid.uuid4(),
        )
        assert ids(admin, "milestones", project_id=str(one.pk)) == {str(a.pk)}
        assert ids(admin, "milestones", project=str(two.pk)) == {str(b.pk)}
        assert ids(admin, "milestones", project_id="msy") == {str(b.pk)}  # the code, in any case
        assert ids(admin, "milestones", project_id="NOPE") == set()
        assert ids(admin, "milestones", status="completed") == {str(b.pk)}
        assert ids(admin, "milestones", kind="General") == {str(a.pk)}


class TestOverbookingError:
    def test_an_unknown_alert_says_so_in_plain_words(self, api):
        response = api.post(f"{S}resolve-overbooking/", {"alert_id": "nope"}, format="json")
        assert response.status_code == 400
        assert response.json()["detail"] == "Unknown overbooking alert."
