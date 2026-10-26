"""
What a caller may see of the calendar and of people's pay (DECISIONS D-21).

Events follow their ``visibility`` and project membership; a booking tied to an event or
task the caller cannot see keeps its time slot and loses the title and notes; pay rates and
e-mail addresses need ``schedule.view_rates`` (or being that person).
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory, TaskFactory
from apps.scheduling.models import CalendarEvent, Resource, ResourceSchedule

pytestmark = pytest.mark.django_db

EVENTS = "api:v1:scheduling:calendar-event-list"
RESOURCES = "api:v1:scheduling:resource-list"
SCHEDULES = "api:v1:scheduling:resource-schedule-list"


def _client(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _viewer(*projects, extra=()):
    user = UserFactory.create()
    grant_permissions(user, "schedule.view", *extra)
    for project in projects:
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    return user


def _event(title, *, project=None, visibility="Team", creator=None):
    return CalendarEvent.objects.create(
        title=title,
        project=project,
        visibility=visibility,
        created_by=creator,
        start_time="2026-09-01T10:00:00Z",
        end_time="2026-09-01T11:00:00Z",
    )


def _titles(user, url=EVENTS):
    return sorted(row["title"] for row in _client(user).get(reverse(url)).json())


@pytest.fixture
def show():
    return ProjectFactory.create(code="CAL1")


@pytest.fixture
def other_show():
    return ProjectFactory.create(code="CAL2")


class TestEventVisibility:
    def test_a_team_event_of_a_project_is_for_its_members(self, show, other_show):
        _event("show only", project=show)
        member, outsider = _viewer(show), _viewer(other_show)

        assert _titles(member) == ["show only"]
        assert _titles(outsider) == []

    def test_a_team_event_without_a_project_is_for_everyone_who_may_view(self):
        _event("all hands")

        assert _titles(_viewer()) == ["all hands"]

    @pytest.mark.parametrize("visibility", ["Organization", "Public"])
    def test_organization_and_public_events_reach_non_members(self, show, other_show, visibility):
        _event("studio wide", project=show, visibility=visibility)

        assert _titles(_viewer(other_show)) == ["studio wide"]

    def test_a_private_event_is_its_creators_alone_even_among_project_members(self, show):
        author = _viewer(show)
        _event("my dentist", project=show, visibility="Private", creator=author)
        colleague = _viewer(show)

        assert _titles(author) == ["my dentist"]
        assert _titles(colleague) == []

    def test_a_platform_admin_sees_everything(self, show):
        _event("private", project=show, visibility="Private", creator=_viewer())
        admin = UserFactory.create(is_superuser=True, is_staff=True)

        assert _titles(admin) == ["private"]

    def test_an_event_out_of_scope_is_a_404_for_every_way_in(self, show, other_show):
        event = _event("show only", project=show)
        outsider = _viewer(other_show, extra=("schedule.update", "schedule.delete"))
        api = _client(outsider)
        kwargs = {"uuid": str(event.id)}

        assert (
            api.get(reverse("api:v1:scheduling:calendar-event-detail", kwargs=kwargs)).status_code
            == 404
        )
        assert (
            api.patch(
                reverse("api:v1:scheduling:calendar-event-detail", kwargs=kwargs),
                {"title": "x"},
                format="json",
            ).status_code
            == 404
        )
        assert (
            api.delete(
                reverse("api:v1:scheduling:calendar-event-detail", kwargs=kwargs)
            ).status_code
            == 404
        )
        assert (
            api.post(
                reverse("api:v1:scheduling:calendar-event-update-status", kwargs=kwargs),
                {"status": "Cancelled"},
                format="json",
            ).status_code
            == 404
        )
        event.refresh_from_db()
        assert (event.title, event.status, event.is_deleted) == ("show only", "Scheduled", False)

    def test_leaving_a_project_removes_its_events(self, show):
        _event("show only", project=show)
        member = _viewer(show)
        assert _titles(member) == ["show only"]

        ProjectMembership.objects.filter(user=member, project=show).update(status="inactive")

        assert _titles(member) == []


class TestPayRatesAndEmails:
    @pytest.fixture
    def colleague(self):
        user = UserFactory.create(email="colleague@example.com")
        Resource.objects.create(
            name="Colleague", code="R-1", resource_type="Person", user=user, hourly_rate_usd=150
        )
        return user

    def _row(self, user):
        return _client(user).get(reverse(RESOURCES)).json()[0]

    def test_without_the_code_rate_and_email_are_hidden(self, colleague):
        row = self._row(_viewer())

        assert (row["hourly_rate_usd"], row["user_email"]) == (None, "")
        assert row["name"] == "Colleague"  # the resource itself stays visible

    def test_the_code_shows_them(self, colleague):
        row = self._row(_viewer(extra=("schedule.view_rates",)))

        assert (row["hourly_rate_usd"], row["user_email"]) == ("150.00", "colleague@example.com")

    def test_a_person_sees_their_own(self, colleague):
        grant_permissions(colleague, "schedule.view")

        assert self._row(colleague)["hourly_rate_usd"] == "150.00"

    def test_a_superuser_sees_them(self, colleague):
        admin = UserFactory.create(is_superuser=True, is_staff=True)

        assert self._row(admin)["hourly_rate_usd"] == "150.00"

    def test_the_detail_view_follows_the_same_rule(self, colleague):
        resource = Resource.objects.get(code="R-1")
        url = reverse("api:v1:scheduling:resource-detail", kwargs={"uuid": str(resource.id)})

        assert _client(_viewer()).get(url).json()["hourly_rate_usd"] is None
        assert (
            _client(_viewer(extra=("schedule.view_rates",))).get(url).json()["hourly_rate_usd"]
            == "150.00"
        )

    def test_the_full_roles_hold_the_code_and_the_working_roles_do_not(self):
        from apps.core.management.commands import init_platform as seed

        assert "schedule.view_rates" in seed.PRODUCTION_FULL_PERMISSIONS
        assert "schedule.view_rates" not in seed.PRODUCTION_LEAD_PERMISSIONS
        assert "schedule.view_rates" not in seed.PRODUCTION_ARTIST_PERMISSIONS


class TestBookingsDoNotLeakTitles:
    def _booking(self, **links):
        resource = Resource.objects.get_or_create(
            code="R-9", defaults={"name": "R9", "resource_type": "Person"}
        )[0]
        return ResourceSchedule.objects.create(
            resource=resource,
            start_time="2026-09-01T10:00:00Z",
            end_time="2026-09-01T12:00:00Z",
            notes="secret note",
            **links,
        )

    def _rows(self, user):
        return _client(user).get(reverse(SCHEDULES)).json()

    def test_a_task_of_another_project_is_anonymised(self, show, other_show):
        task = TaskFactory.create(project=show, code="T1", title="Secret task")
        self._booking(task=task)

        member = self._rows(_viewer(show))[0]
        outsider = self._rows(_viewer(other_show))[0]

        assert (member["task_title"], member["notes"]) == ("Secret task", "secret note")
        assert (outsider["task_title"], outsider["notes"]) == ("Booked on another project", "")
        assert outsider["start_time"] == member["start_time"]  # the slot stays, for planning

    def test_a_private_event_is_anonymised_for_others(self, show):
        author = _viewer(show)
        event = _event("my dentist", project=show, visibility="Private", creator=author)
        self._booking(event=event)

        assert self._rows(author)[0]["event_title"] == "my dentist"
        assert self._rows(_viewer(show))[0]["event_title"] == "Booked on another project"

    def test_a_booking_with_no_links_is_untouched(self):
        self._booking()

        row = self._rows(_viewer())[0]

        assert row["notes"] == "secret note"
        assert "Booked on another project" not in (row.get("task_title"), row.get("event_title"))
