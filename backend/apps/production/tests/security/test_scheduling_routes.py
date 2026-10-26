"""
The production scheduling endpoints (capacity, overbooking, resolve-overbooking).

They used to need only a login and showed and changed every project's bookings. Now:
``schedule.view`` reads, ``schedule.update`` resolves; the bookings listed in an
overbooking alert and the ones a resolve flags are limited to the caller's projects
and studio-wide ones. Hours always count every booking, so the excess stays true.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory
from apps.scheduling.models import CalendarEvent, Resource, ResourceSchedule
from apps.scheduling.selectors.capacity import REDACTED_TITLE

pytestmark = pytest.mark.django_db

CAPACITY = "/api/v1/scheduling/capacity/"
OVERBOOKING = "/api/v1/scheduling/overbooking/"
RESOLVE = "/api/v1/scheduling/resolve-overbooking/"


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _user(*codes, project=None, **fields):
    user = UserFactory.create(**fields)
    if codes:
        grant_permissions(user, *codes)
    if project is not None:
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    return user


def _monday():
    now = timezone.now()
    return (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)


@pytest.fixture
def board():
    """One resource (20h/week) booked 15h for project A, 15h for project B and 10h studio-wide."""
    project_a = ProjectFactory.create(code="SCHA")
    project_b = ProjectFactory.create(code="SCHB")
    resource = Resource.objects.create(
        name="Compositor", code="SCH-1", resource_type="Person", capacity_hours_per_week=20
    )
    start = _monday() + timedelta(hours=9)
    slots = {}
    for key, project, hours, title in (
        ("a", project_a, 15, "A secret grade"),
        ("b", project_b, 15, "B secret grade"),
        ("studio", None, 10, "All hands"),
    ):
        event = CalendarEvent.objects.create(
            title=title, project=project, start_time=start, end_time=start + timedelta(hours=hours)
        )
        slots[key] = ResourceSchedule.objects.create(
            resource=resource,
            event=event,
            start_time=start,
            end_time=start + timedelta(hours=hours),
            status="Booked",
        )
    return {"a": project_a, "b": project_b, "resource": resource, "slots": slots}


class TestPermissions:
    def test_anonymous_is_401(self):
        client = APIClient()

        assert client.get(CAPACITY).status_code == 401
        assert client.get(OVERBOOKING).status_code == 401
        assert client.post(RESOLVE, {"alert_id": "x"}, format="json").status_code == 401

    def test_a_login_alone_is_not_enough(self):
        client = _client(_user())

        assert client.get(CAPACITY).status_code == 403
        assert client.get(OVERBOOKING).status_code == 403
        assert client.post(RESOLVE, {"alert_id": "x"}, format="json").status_code == 403

    def test_view_reads_but_cannot_resolve(self, board):
        client = _client(_user("schedule.view"))

        assert client.get(CAPACITY).status_code == 200
        assert client.get(OVERBOOKING).status_code == 200
        resp = client.post(
            RESOLVE, {"alert_id": "x", "resource_id": str(board["resource"].id)}, format="json"
        )
        assert resp.status_code == 403
        assert set(ResourceSchedule.objects.values_list("status", flat=True)) == {"Booked"}

    def test_update_alone_does_not_read(self):
        client = _client(_user("schedule.update"))

        assert client.get(CAPACITY).status_code == 403
        assert client.get(OVERBOOKING).status_code == 403

    def test_the_other_methods_are_denied(self):
        client = _client(_user("schedule.view", "schedule.update"))

        assert client.post(CAPACITY, {}, format="json").status_code == 403
        assert client.delete(OVERBOOKING).status_code == 403
        assert client.get(RESOLVE).status_code == 403


class TestOverbookingIsScoped:
    def alert(self, user):
        resp = _client(user).get(OVERBOOKING)
        assert resp.status_code == 200, resp.json()
        (alert,) = resp.json()
        return alert

    def test_a_member_sees_their_projects_and_the_studio_wide_bookings_only(self, board):
        member = _user("schedule.view", project=board["a"])

        alert = self.alert(member)

        titles = sorted(event["title"] for event in alert["conflicting_events"])
        assert titles == sorted(["A secret grade", "All hands", REDACTED_TITLE])
        redacted = next(e for e in alert["conflicting_events"] if e["title"] == REDACTED_TITLE)
        assert redacted["project_code"] is None and redacted["hours"] == 15.0
        assert "B secret grade" not in str(alert) and "SCHB" not in str(alert)

    def test_the_excess_still_counts_every_booking(self, board):
        member = _user("schedule.view", project=board["a"])
        alert = self.alert(member)

        assert (alert["scheduled_hours"], alert["max_capacity_hours"], alert["excess_hours"]) == (
            40.0,
            20,
            20.0,
        )

    def test_someone_in_no_project_sees_only_the_studio_wide_bookings(self, board):
        alert = self.alert(_user("schedule.view"))

        titles = sorted(event["title"] for event in alert["conflicting_events"])
        assert titles == sorted(["All hands", REDACTED_TITLE, REDACTED_TITLE])

    def test_a_platform_admin_sees_everything(self, board):
        admin = _user("schedule.view", is_superuser=True)

        titles = {event["title"] for event in self.alert(admin)["conflicting_events"]}

        assert titles == {"A secret grade", "B secret grade", "All hands"}


class TestResolveIsScoped:
    def resolve(self, user, board):
        return _client(user).post(
            RESOLVE, {"alert_id": "x", "resource_id": str(board["resource"].id)}, format="json"
        )

    def test_only_visible_bookings_are_flagged(self, board):
        member = _user("schedule.view", "schedule.update", project=board["a"])

        resp = self.resolve(member, board)

        assert resp.status_code == 200, resp.json()
        statuses = {
            key: slot.__class__.objects.get(pk=slot.pk).status
            for key, slot in board["slots"].items()
        }
        assert statuses == {"a": "Overbooked", "studio": "Overbooked", "b": "Booked"}

    def test_a_platform_admin_flags_all(self, board):
        admin = _user("schedule.view", "schedule.update", is_superuser=True)

        assert self.resolve(admin, board).status_code == 200

        statuses = set(ResourceSchedule.objects.values_list("status", flat=True))
        assert statuses == {"Overbooked"}

    def test_the_reply_does_not_name_hidden_bookings(self, board):
        member = _user("schedule.view", "schedule.update", project=board["a"])

        message = self.resolve(member, board).json()["message"]

        assert "B secret grade" not in message and "SCHB" not in message

    def test_unknown_resource_is_404_and_a_missing_alert_is_400(self, board):
        member = _user("schedule.view", "schedule.update", project=board["a"])
        client = _client(member)

        missing = client.post(
            RESOLVE,
            {"alert_id": "x", "resource_id": "00000000-0000-0000-0000-000000000000"},
            format="json",
        )
        malformed = client.post(RESOLVE, {"alert_id": "x"}, format="json")

        assert missing.status_code == 404
        assert malformed.status_code == 400
