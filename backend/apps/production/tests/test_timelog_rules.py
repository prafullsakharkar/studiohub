"""
Timelog rules: the Submitted flow, final approvals, adjustment entries and
own-records scoping (``timelog.view`` own, ``timelog.view_all`` the project's).
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership, StatusHistory, Timelog
from apps.production.tests.factories import ProjectFactory, TaskFactory, TimelogFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def project():
    return ProjectFactory.create(code="TLR01")


@pytest.fixture
def task(project):
    return TaskFactory.create(project=project, code="T1")


def _user(project, *codes):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


APPROVER = ("timelog.view", "timelog.view_all", "timelog.approve")


class TestFlow:
    @pytest.mark.parametrize("source", ["Draft", "Rejected", "Approved"])
    def test_only_a_submitted_log_can_be_approved_or_rejected(self, project, task, source):
        log = TimelogFactory.create(task=task, status=source)
        approver = _user(project, *APPROVER)

        approve = _client(approver).post(f"/api/v1/timelogs/{log.id}/approve/", {}, format="json")
        reject = _client(approver).post(
            f"/api/v1/timelogs/{log.id}/reject/", {"rejection_reason": "x"}, format="json"
        )

        # The same status again is a conflict (somebody got there first); the rest are invalid moves.
        assert approve.status_code == (409 if source == "Approved" else 400)
        assert reject.status_code == (409 if source == "Rejected" else 400)
        log.refresh_from_db()
        assert log.status == source

    def test_reject_needs_a_reason_and_keeps_it(self, project, task):
        log = TimelogFactory.create(task=task)
        approver = _user(project, *APPROVER)
        client = _client(approver)
        url = f"/api/v1/timelogs/{log.id}/reject/"

        assert client.post(url, {}, format="json").status_code == 400
        assert client.post(url, {"rejection_reason": "   "}, format="json").status_code == 400
        done = client.post(url, {"rejection_reason": "wrong task"}, format="json")

        assert done.status_code == 200, done.json()
        log.refresh_from_db()
        assert (log.status, log.rejection_reason) == ("Rejected", "wrong task")
        assert StatusHistory.objects.get(entity_id=log.id).reason == "wrong task"

    def test_a_rejected_log_can_be_resubmitted_by_its_owner(self, project, task):
        owner = _user(project, "timelog.view", "timelog.update")
        log = TimelogFactory.create(task=task, person=owner, status="Rejected")

        resp = _client(owner).patch(
            f"/api/v1/timelogs/{log.id}/", {"status": "Submitted"}, format="json"
        )

        assert resp.status_code == 200, resp.json()

    def test_a_second_approval_is_a_conflict(self, project, task):
        log = TimelogFactory.create(task=task)
        first, second = _user(project, *APPROVER), _user(project, *APPROVER)

        one = _client(first).post(f"/api/v1/timelogs/{log.id}/approve/", {}, format="json")
        two = _client(second).post(f"/api/v1/timelogs/{log.id}/approve/", {}, format="json")

        assert (one.status_code, two.status_code) == (200, 409)
        assert StatusHistory.objects.filter(entity_id=log.id).count() == 1


class TestFinal:
    def test_an_approved_log_cannot_be_edited_deleted_or_archived(self, project, task):
        owner = _user(project, "timelog.view", "timelog.update", "timelog.delete")
        log = TimelogFactory.create(task=task, person=owner, status="Approved")
        client = _client(owner)
        url = f"/api/v1/timelogs/{log.id}/"

        assert client.patch(url, {"notes": "edit"}, format="json").status_code == 409
        assert client.delete(url).status_code == 409
        log.refresh_from_db()
        assert log.notes == "" and log.is_deleted is False


class TestAdjustment:
    def body(self, task, original, hours="-1.50", **extra):
        return {
            "task": str(task.id),
            "adjustment_of": str(original.id),
            "duration_hours": hours,
            "date": "2026-10-26",
            **extra,
        }

    def test_an_approved_log_is_corrected_with_a_new_entry(self, project, task):
        owner = _user(project, "timelog.view", "timelog.create")
        original = TimelogFactory.create(
            task=task, person=owner, status="Approved", duration_hours=Decimal("8")
        )

        resp = _client(owner).post("/api/v1/timelogs/", self.body(task, original), format="json")

        assert resp.status_code == 201, resp.json()
        adjustment = Timelog.objects.get(id=resp.json()["id"])
        assert (adjustment.adjustment_of_id, adjustment.person_id, adjustment.status) == (
            original.id,
            owner.id,
            "Submitted",
        )
        assert adjustment.duration_hours == Decimal("-1.50")
        original.refresh_from_db()
        assert (original.status, original.duration_hours) == ("Approved", Decimal("8.00"))

    def test_only_an_approved_log_can_be_adjusted(self, project, task):
        owner = _user(project, "timelog.view", "timelog.create")
        draft = TimelogFactory.create(task=task, person=owner, status="Submitted")

        resp = _client(owner).post("/api/v1/timelogs/", self.body(task, draft), format="json")

        assert resp.status_code == 400
        assert "adjustment_of" in resp.json()

    def test_zero_is_not_an_adjustment(self, project, task):
        owner = _user(project, "timelog.view", "timelog.create")
        original = TimelogFactory.create(task=task, person=owner, status="Approved")

        resp = _client(owner).post(
            "/api/v1/timelogs/", self.body(task, original, hours="0"), format="json"
        )

        assert resp.status_code == 400

    def test_adjusting_someone_elses_hours_needs_the_manage_code(self, project, task):
        other = _user(project)
        original = TimelogFactory.create(task=task, person=other, status="Approved")
        plain = _user(project, "timelog.view", "timelog.create")
        manager = _user(project, "timelog.view", "timelog.create", "timelog.manage")

        assert (
            _client(plain)
            .post("/api/v1/timelogs/", self.body(task, original), format="json")
            .status_code
            == 403
        )
        done = _client(manager).post("/api/v1/timelogs/", self.body(task, original), format="json")
        assert done.status_code == 201, done.json()
        assert Timelog.objects.get(id=done.json()["id"]).person_id == other.id

    def test_the_original_must_be_in_the_same_project(self, project, task):
        other_project = ProjectFactory.create(code="TLR02")
        foreign = TimelogFactory.create(
            task=TaskFactory.create(project=other_project, code="T2"), status="Approved"
        )
        user = _user(
            project, "timelog.view", "timelog.view_all", "timelog.create", "timelog.manage"
        )

        resp = _client(user).post("/api/v1/timelogs/", self.body(task, foreign), format="json")

        assert resp.status_code == 400


class TestOwnRecords:
    def test_view_shows_only_the_callers_logs_and_view_all_shows_the_project(self, project, task):
        mine_user = _user(project, "timelog.view")
        reader = _user(project, "timelog.view", "timelog.view_all")
        mine = TimelogFactory.create(task=task, person=mine_user)
        theirs = TimelogFactory.create(task=task, person=reader)

        own = _client(mine_user).get("/api/v1/timelogs/")
        everyone = _client(reader).get("/api/v1/timelogs/")

        assert {row["id"] for row in own.json()["results"]} == {str(mine.id)}
        assert {row["id"] for row in everyone.json()["results"]} == {str(mine.id), str(theirs.id)}

    def test_someone_elses_log_is_not_found_for_read_and_write(self, project, task):
        artist = _user(project, "timelog.view", "timelog.update", "timelog.delete")
        other = _user(project)
        log = TimelogFactory.create(task=task, person=other)
        client = _client(artist)
        url = f"/api/v1/timelogs/{log.id}/"

        assert client.get(url).status_code == 404
        assert client.patch(url, {"notes": "x"}, format="json").status_code == 404
        assert client.delete(url).status_code == 404

    def test_the_archived_listing_is_narrowed_too(self, project, task):
        artist = _user(project, "timelog.view")
        other = _user(project)
        theirs = TimelogFactory.create(task=task, person=other)
        theirs.delete()

        resp = _client(artist).get("/api/v1/timelogs/archived/")

        assert resp.status_code == 200
        assert resp.json()["results"] == []
