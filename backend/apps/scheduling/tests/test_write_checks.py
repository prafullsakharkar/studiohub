"""
Writes to the calendar are checked (DECISIONS D-22): references stay inside the caller's
scope and look the same whether they are missing or out of reach, statuses and times are
validated, and the edit endpoints for events and resources work.
"""

from __future__ import annotations

import uuid

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory, TaskFactory
from apps.scheduling.models import CalendarEvent, Resource, ResourceSchedule

pytestmark = pytest.mark.django_db

CODES = ("schedule.view", "schedule.create", "schedule.update")


def _editor(*projects):
    user = UserFactory.create()
    grant_permissions(user, *CODES)
    for project in projects:
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    api = APIClient()
    api.force_authenticate(user=user)
    return user, api


def _event(title="E", *, project=None, visibility="Team", creator=None, status="Scheduled"):
    return CalendarEvent.objects.create(
        title=title,
        project=project,
        visibility=visibility,
        created_by=creator,
        status=status,
        start_time="2026-09-01T10:00:00Z",
        end_time="2026-09-01T11:00:00Z",
    )


def _resource(code="R-1", **extra):
    return Resource.objects.create(name=code, code=code, resource_type="Person", **extra)


def _event_url(event, name="detail"):
    return reverse(f"api:v1:scheduling:calendar-event-{name}", kwargs={"uuid": str(event.id)})


@pytest.fixture
def mine():
    return ProjectFactory.create(code="WRT1")


@pytest.fixture
def theirs():
    return ProjectFactory.create(code="WRT2")


class TestEditEndpoints:
    def test_an_event_can_be_edited_and_answers_in_the_detail_shape(self, mine):
        _, api = _editor()
        event = _event("old")

        resp = api.patch(_event_url(event), {"title": "new", "location": "room 4"}, format="json")

        assert resp.status_code == 200, resp.json()
        assert (resp.json()["title"], resp.json()["location"]) == ("new", "room 4")
        assert "id" in resp.json()
        event.refresh_from_db()
        assert (event.title, event.location) == ("new", "room 4")

    def test_a_put_works_too(self):
        _, api = _editor()
        event = _event("old")
        body = {
            "title": "new",
            "start_time": "2026-09-02T10:00:00Z",
            "end_time": "2026-09-02T11:00:00Z",
        }

        assert api.put(_event_url(event), body, format="json").status_code == 200

    def test_a_resource_can_be_edited(self):
        _, api = _editor()
        resource = _resource()
        url = reverse("api:v1:scheduling:resource-detail", kwargs={"uuid": str(resource.id)})

        resp = api.patch(
            url,
            # "On Leave" is derived from approved leave since Phase 10 (Q33) and cannot be written;
            # "Unavailable" is still a stored, writable status.
            {"hourly_rate_usd": "80.00", "capacity_hours_per_week": 32, "status": "Unavailable"},
            format="json",
        )

        assert resp.status_code == 200, resp.json()
        resource.refresh_from_db()
        assert (
            str(resource.hourly_rate_usd),
            resource.capacity_hours_per_week,
            resource.status,
        ) == ("80.00", 32, "Unavailable")

    def test_a_resource_edit_cannot_point_at_a_missing_department(self):
        _, api = _editor()
        resource = _resource()
        url = reverse("api:v1:scheduling:resource-detail", kwargs={"uuid": str(resource.id)})

        resp = api.patch(url, {"department_id": str(uuid.uuid4())}, format="json")

        assert resp.status_code == 400 and "Unknown department." in str(resp.json())


class TestEventRules:
    def test_a_project_must_be_one_the_caller_belongs_to(self, mine, theirs):
        _, api = _editor(mine)
        body = {
            "title": "t",
            "start_time": "2026-09-01T10:00:00Z",
            "end_time": "2026-09-01T11:00:00Z",
        }

        foreign = api.post(
            reverse("api:v1:scheduling:calendar-event-list"),
            {**body, "project_id": str(theirs.id)},
            format="json",
        )
        missing = api.post(
            reverse("api:v1:scheduling:calendar-event-list"),
            {**body, "project_id": str(uuid.uuid4())},
            format="json",
        )
        own = api.post(
            reverse("api:v1:scheduling:calendar-event-list"),
            {**body, "project_id": str(mine.id)},
            format="json",
        )

        assert foreign.status_code == missing.status_code == 400
        assert foreign.json()["project_id"] == missing.json()["project_id"] == ["Unknown project."]
        assert own.status_code == 201, own.json()
        assert CalendarEvent.objects.count() == 1

    def test_a_platform_admin_may_use_any_project(self, theirs):
        admin = UserFactory.create(is_superuser=True, is_staff=True)
        api = APIClient()
        api.force_authenticate(user=admin)

        resp = api.post(
            reverse("api:v1:scheduling:calendar-event-list"),
            {
                "title": "t",
                "start_time": "2026-09-01T10:00:00Z",
                "end_time": "2026-09-01T11:00:00Z",
                "project_id": str(theirs.id),
            },
            format="json",
        )

        assert resp.status_code == 201, resp.json()

    def test_an_end_before_the_start_is_refused(self):
        _, api = _editor()
        event = _event()

        created = api.post(
            reverse("api:v1:scheduling:calendar-event-list"),
            {
                "title": "t",
                "start_time": "2026-09-01T12:00:00Z",
                "end_time": "2026-09-01T10:00:00Z",
            },
            format="json",
        )
        edited = api.patch(_event_url(event), {"end_time": "2026-09-01T09:00:00Z"}, format="json")

        assert created.status_code == edited.status_code == 400
        assert "end_time" in created.json() and "end_time" in edited.json()

    def test_unknown_statuses_are_refused(self):
        _, api = _editor()
        event = _event()

        action = api.post(_event_url(event, "update-status"), {"status": "Pwned"}, format="json")
        patched = api.patch(_event_url(event), {"status": "Pwned"}, format="json")

        assert action.status_code == patched.status_code == 400
        event.refresh_from_db()
        assert event.status == "Scheduled"

    @pytest.mark.parametrize("final", ["Completed", "Cancelled"])
    def test_a_finished_or_cancelled_event_stays_so(self, final):
        _, api = _editor()
        event = _event(status=final)

        action = api.post(
            _event_url(event, "update-status"), {"status": "Scheduled"}, format="json"
        )
        patched = api.patch(_event_url(event), {"status": "In Progress"}, format="json")
        echoed = api.patch(_event_url(event), {"status": final, "title": "kept"}, format="json")

        assert action.status_code == patched.status_code == 400
        assert echoed.status_code == 200, echoed.json()
        event.refresh_from_db()
        assert (event.status, event.title) == (final, "kept")

    def test_the_other_states_move_freely(self):
        _, api = _editor()
        event = _event()

        for status in ("In Progress", "Postponed", "Scheduled", "Completed"):
            assert (
                api.post(
                    _event_url(event, "update-status"), {"status": status}, format="json"
                ).status_code
                == 200
            )


class TestBookingReferences:
    def _body(self, resource, **extra):
        return {
            "resource": str(resource.id),
            "start_time": "2026-09-01T10:00:00Z",
            "end_time": "2026-09-01T12:00:00Z",
            "status": "Booked",
            **extra,
        }

    def test_a_task_of_another_project_reads_like_a_missing_one(self, mine, theirs):
        _, api = _editor(mine)
        resource = _resource()
        foreign = TaskFactory.create(project=theirs, code="TF")
        url = reverse("api:v1:scheduling:resource-schedule-list")

        out_of_reach = api.post(url, self._body(resource, task=str(foreign.id)), format="json")
        missing = api.post(url, self._body(resource, task=str(uuid.uuid4())), format="json")
        garbage = api.post(url, self._body(resource, task="nope"), format="json")

        assert out_of_reach.status_code == missing.status_code == garbage.status_code == 400
        assert (
            out_of_reach.json()["task"]
            == missing.json()["task"]
            == garbage.json()["task"]
            == ["Unknown task."]
        )
        assert not ResourceSchedule.objects.exists()

    def test_an_event_the_caller_cannot_see_reads_like_a_missing_one(self, mine):
        author, _ = _editor(mine)
        private = _event("private", project=mine, visibility="Private", creator=author)
        _, api = _editor(mine)  # same project, but the event is private to its author
        resource = _resource()
        url = reverse("api:v1:scheduling:resource-schedule-list")

        resp = api.post(url, self._body(resource, event=str(private.id)), format="json")

        assert resp.status_code == 400 and resp.json()["event"] == ["Unknown event."]

    def test_visible_links_are_accepted_and_editing_cannot_move_them_out_of_scope(
        self, mine, theirs
    ):
        _, api = _editor(mine)
        resource = _resource()
        own_task = TaskFactory.create(project=mine, code="TM")
        foreign = TaskFactory.create(project=theirs, code="TF")
        url = reverse("api:v1:scheduling:resource-schedule-list")

        created = api.post(url, self._body(resource, task=str(own_task.id)), format="json")
        assert created.status_code == 201, created.json()
        detail = reverse(
            "api:v1:scheduling:resource-schedule-detail", kwargs={"uuid": created.json()["id"]}
        )
        moved = api.patch(detail, {"task": str(foreign.id)}, format="json")

        assert moved.status_code == 400 and moved.json()["task"] == ["Unknown task."]
        assert ResourceSchedule.objects.get().task_id == own_task.id

    def test_a_booking_must_end_after_it_starts(self):
        _, api = _editor()
        resource = _resource()

        resp = api.post(
            reverse("api:v1:scheduling:resource-schedule-list"),
            self._body(
                resource, start_time="2026-09-01T12:00:00Z", end_time="2026-09-01T10:00:00Z"
            ),
            format="json",
        )

        assert resp.status_code == 400 and "end_time" in resp.json()


class TestBookAndBlock:
    def _book(self, api, resource, **body):
        base = {"start_time": "2026-09-01T10:00:00Z", "end_time": "2026-09-01T12:00:00Z"}
        url = reverse("api:v1:scheduling:resource-book", kwargs={"uuid": str(resource.id)})
        return api.post(url, {**base, **body}, format="json")

    @pytest.mark.parametrize(
        "body",
        [
            {"status": "Pwned"},
            {"start_time": "2026-09-01T12:00:00Z", "end_time": "2026-09-01T10:00:00Z"},
            {"start_time": "tomorrow", "end_time": "later"},
            {"task_id": "nope"},
            {"event_id": "nope"},
        ],
    )
    def test_bad_payloads_are_a_400_and_nothing_is_stored(self, body):
        _, api = _editor()
        resource = _resource()

        resp = self._book(api, resource, **body)

        assert resp.status_code == 400, resp.json()
        assert not ResourceSchedule.objects.exists()

    def test_book_refuses_a_foreign_task_and_accepts_an_own_one(self, mine, theirs):
        _, api = _editor(mine)
        resource = _resource()
        foreign = TaskFactory.create(project=theirs, code="TF")
        own = TaskFactory.create(project=mine, code="TM")

        refused = self._book(api, resource, task_id=str(foreign.id))
        accepted = self._book(api, resource, task_id=str(own.id), notes="n")

        assert refused.status_code == 400 and refused.json()["task_id"] == ["Unknown task."]
        assert accepted.status_code == 201, accepted.json()
        assert ResourceSchedule.objects.get().task_id == own.id

    def test_block_checks_the_times(self):
        _, api = _editor()
        resource = _resource()
        url = reverse("api:v1:scheduling:resource-block", kwargs={"uuid": str(resource.id)})

        bad = api.post(
            url,
            {"start_time": "2026-09-01T12:00:00Z", "end_time": "2026-09-01T10:00:00Z"},
            format="json",
        )
        good = api.post(
            url,
            {
                "start_time": "2026-09-01T10:00:00Z",
                "end_time": "2026-09-01T12:00:00Z",
                "reason": "service",
            },
            format="json",
        )

        assert bad.status_code == 400
        assert good.status_code == 201 and good.json()["status"] == "Blocked"


class TestResourceCreate:
    def _post(self, api, **body):
        return api.post(
            reverse("api:v1:scheduling:resource-list"),
            {"name": "N", "code": "R-NEW", **body},
            format="json",
        )

    def test_a_duplicate_code_is_a_400_in_any_case(self):
        _, api = _editor()
        _resource("R-NEW")

        resp = self._post(api, code="r-new")

        assert resp.status_code == 400 and "code" in resp.json()
        assert Resource.objects.count() == 1

    def test_a_soft_deleted_resource_still_owns_its_code(self):
        _, api = _editor()
        gone = _resource("R-NEW")
        Resource.objects.filter(pk=gone.pk).update(is_deleted=True)

        assert self._post(api).status_code == 400

    @pytest.mark.parametrize("field", ["user_id", "department_id", "team_id"])
    def test_links_to_missing_records_are_a_400_not_silently_dropped(self, field):
        _, api = _editor()

        resp = self._post(api, **{field: str(uuid.uuid4())})

        assert resp.status_code == 400 and field in resp.json()
        assert not Resource.objects.filter(code="R-NEW").exists()

    def test_a_valid_create_still_works(self):
        user, api = _editor()

        resp = self._post(api, user_id=str(user.id))

        assert resp.status_code == 201, resp.json()
        assert Resource.objects.get(code="R-NEW").user_id == user.id
