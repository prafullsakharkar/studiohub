"""
Status workflow (analysis finding F-M5, WP D4, D5, F2).

Every status change goes through ``StatusService.transition_status``: the move
must be allowed, the caller must hold the permission it needs, and an
append-only ``StatusHistory`` row and a ``StatusChanged`` event record it.
"""

from __future__ import annotations

from unittest import mock

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.events.status import StatusChanged
from apps.production.exceptions import InvalidTransition, TransitionNotPermitted
from apps.production.models import ProjectMembership, StatusHistory
from apps.production.services.status import StatusService
from apps.production.tests.factories import (
    ProjectFactory,
    ReviewFactory,
    ShotFactory,
    TaskFactory,
    TimelogFactory,
    VersionFactory,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def project():
    return ProjectFactory.create(code="WFLOW1")


def _user(project, *codes):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _history(entity):
    return list(StatusHistory.objects.filter(entity_id=entity.pk).order_by("changed_at"))


class TestTransitionStatus:
    def test_writes_history_and_event(self, project):
        shot = ShotFactory.create(project=project, code="S1")
        actor = _user(project)

        with mock.patch("apps.production.services.status.default_event_bus.publish") as publish:
            StatusService.transition_status(
                actor=actor, entity=shot, to_status="In Progress", reason="started"
            )

        shot.refresh_from_db()
        assert shot.status == "In Progress"
        (row,) = _history(shot)
        assert (row.entity_type, row.entity_code, row.from_status, row.to_status) == (
            "Shot",
            "S1",
            "Not Started",
            "In Progress",
        )
        assert (row.actor, row.reason, row.project) == (actor, "started", project)
        (event,) = [call.args[0] for call in publish.call_args_list]
        assert isinstance(event, StatusChanged)
        assert event.payload["to_status"] == "In Progress"

    def test_same_status_is_a_noop_without_history(self, project):
        shot = ShotFactory.create(project=project, code="S1")

        StatusService.transition_status(actor=_user(project), entity=shot, to_status="Not Started")

        assert _history(shot) == []

    def test_unknown_status_and_illegal_move_are_rejected(self, project):
        shot = ShotFactory.create(project=project, code="S1")
        review = ReviewFactory.create(project=project, status="Closed")
        actor = _user(project)

        with pytest.raises(InvalidTransition):
            StatusService.transition_status(actor=actor, entity=shot, to_status="Done")
        with pytest.raises(InvalidTransition):
            StatusService.transition_status(actor=actor, entity=review, to_status="In Review")
        shot.refresh_from_db()
        assert shot.status == "Not Started"
        assert _history(shot) == [] and _history(review) == []

    def test_permission_is_checked_for_entering_and_leaving_approved(self, project):
        shot = ShotFactory.create(project=project, code="S1")
        plain = _user(project)
        approver = _user(project, "shot.approve")

        with pytest.raises(TransitionNotPermitted):
            StatusService.transition_status(actor=plain, entity=shot, to_status="Approved")
        StatusService.transition_status(actor=approver, entity=shot, to_status="Approved")
        with pytest.raises(TransitionNotPermitted):
            StatusService.transition_status(actor=plain, entity=shot, to_status="Retake")

        assert [(row.from_status, row.to_status) for row in _history(shot)] == [
            ("Not Started", "Approved")
        ]

    def test_system_moves_skip_the_checks_but_keep_the_history(self, project):
        review = ReviewFactory.create(project=project, status="Closed")

        StatusService.transition_status(
            actor=_user(project), entity=review, to_status="Pending Review", enforce=False
        )

        assert len(_history(review)) == 1

    def test_history_is_append_only(self, project):
        shot = ShotFactory.create(project=project, code="S1")
        StatusService.transition_status(actor=_user(project), entity=shot, to_status="In Progress")
        row = StatusHistory.objects.get()

        row.reason = "edited"
        with pytest.raises(TypeError):
            row.save()
        with pytest.raises(TypeError):
            row.delete()
        with pytest.raises(TypeError):
            StatusHistory.objects.all().update(reason="x")
        with pytest.raises(TypeError):
            StatusHistory.objects.all().delete()
        assert StatusHistory.objects.get().reason == ""


class TestPlainUpdate:
    def test_status_change_is_checked_and_recorded(self, project):
        shot = ShotFactory.create(project=project, code="S1")
        user = _user(project, "shot.view", "shot.update")

        ok = _client(user).patch(
            f"/api/v1/shots/{shot.id}/", {"status": "In Progress"}, format="json"
        )
        bad = _client(user).patch(
            f"/api/v1/shots/{shot.id}/", {"status": "Nonsense"}, format="json"
        )

        assert ok.status_code == status.HTTP_200_OK, ok.json()
        assert bad.status_code == status.HTTP_400_BAD_REQUEST
        assert "status" in bad.json()
        assert [(row.from_status, row.to_status, row.actor) for row in _history(shot)] == [
            ("Not Started", "In Progress", user)
        ]

    def test_other_fields_are_saved_with_the_status_and_roll_back_with_it(self, project):
        shot = ShotFactory.create(project=project, code="S1", name="Old")
        user = _user(project, "shot.view", "shot.update")

        denied = _client(user).patch(
            f"/api/v1/shots/{shot.id}/", {"status": "Approved", "name": "New"}, format="json"
        )
        allowed = _client(user).patch(
            f"/api/v1/shots/{shot.id}/", {"status": "In Progress", "name": "New"}, format="json"
        )

        assert denied.status_code == status.HTTP_403_FORBIDDEN
        assert allowed.status_code == status.HTTP_200_OK
        shot.refresh_from_db()
        assert (shot.name, shot.status) == ("New", "In Progress")

    def test_echoing_the_current_status_writes_no_history(self, project):
        shot = ShotFactory.create(project=project, code="S1")
        user = _user(project, "shot.view", "shot.update")

        resp = _client(user).patch(
            f"/api/v1/shots/{shot.id}/", {"status": "Not Started"}, format="json"
        )

        assert resp.status_code == 200
        assert _history(shot) == []

    def test_create_as_approved_needs_the_code_and_writes_no_history(self, project):
        user = _user(project, "shot.view", "shot.create")
        resp = _client(user).post(
            "/api/v1/shots/",
            {"project_id": str(project.id), "code": "S9", "name": "n", "status": "Approved"},
            format="json",
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN


class TestActions:
    def test_shot_approve(self, project):
        shot = ShotFactory.create(project=project, code="S1", pipeline={"layout": "In Progress"})
        user = _user(project, "shot.view", "shot.approve")

        resp = _client(user).post(f"/api/v1/shots/{shot.id}/approve/", {}, format="json")

        assert resp.status_code == status.HTTP_200_OK, resp.json()
        shot.refresh_from_db()
        assert (shot.status, shot.supervisor_approved, shot.pipeline) == (
            "Approved",
            True,
            {"layout": "Approved"},
        )
        assert [row.to_status for row in _history(shot)] == ["Approved"]

    def test_shot_approve_from_an_archived_shot_is_refused(self, project):
        shot = ShotFactory.create(project=project, code="S1", status="Archived")
        user = _user(project, "shot.view", "shot.approve")

        resp = _client(user).post(f"/api/v1/shots/{shot.id}/approve/", {}, format="json")

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        shot.refresh_from_db()
        assert shot.supervisor_approved is False

    def test_version_promote(self, project):
        version = VersionFactory.create(project=project, code="V1")
        user = _user(project, "version.view", "version.publish")

        resp = _client(user).post(f"/api/v1/versions/{version.id}/promote/", {}, format="json")

        assert resp.status_code == 200, resp.json()
        version.refresh_from_db()
        assert (version.is_hero, version.status) == (True, "Approved")
        assert [row.to_status for row in _history(version)] == ["Approved"]

    def test_review_decision_records_verdict_and_history(self, project):
        review = ReviewFactory.create(project=project)
        user = _user(project, "review.view", "review.update", "review.approve")
        client = _client(user)

        client.post(f"/api/v1/reviews/{review.id}/start-review/", {}, format="json")
        resp = client.post(
            f"/api/v1/reviews/{review.id}/approve/", {"notes": "good"}, format="json"
        )

        assert resp.status_code == 200, resp.json()
        review.refresh_from_db()
        assert (review.status, review.supervisor_verdict) == ("Approved", "Approved")
        assert [(row.from_status, row.to_status) for row in _history(review)] == [
            ("Pending Review", "In Review"),
            ("In Review", "Approved"),
        ]
        assert _history(review)[-1].reason == "good"

    def test_closed_review_cannot_be_reopened_by_an_action(self, project):
        review = ReviewFactory.create(project=project, status="Closed")
        user = _user(project, "review.view", "review.update")

        resp = _client(user).post(f"/api/v1/reviews/{review.id}/submit/", {}, format="json")

        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_timelog_flow(self, project):
        owner = UserFactory.create()
        log = TimelogFactory.create(
            task=TaskFactory.create(project=project, code="T1"), person=owner
        )
        approver = _user(project, "timelog.view", "timelog.approve")

        approved = _client(approver).post(f"/api/v1/timelogs/{log.id}/approve/", {}, format="json")
        again = _client(approver).post(f"/api/v1/timelogs/{log.id}/reject/", {}, format="json")

        assert approved.status_code == 200
        assert again.status_code == status.HTTP_400_BAD_REQUEST  # Approved is final
        log.refresh_from_db()
        assert (log.status, log.approved_by_id) == ("Approved", approver.id)
        assert [row.to_status for row in _history(log)] == ["Approved"]
        assert _history(log)[0].project == project

    def test_archive_and_restore_write_history(self, project):
        task = TaskFactory.create(project=project, code="T1")
        user = _user(project, "task.view", "task.update")
        client = _client(user)

        assert (
            client.post(f"/api/v1/tasks/{task.id}/archive/", {}, format="json").status_code == 200
        )
        assert (
            client.post(f"/api/v1/tasks/{task.id}/restore/", {}, format="json").status_code == 200
        )

        assert [(row.from_status, row.to_status) for row in _history(task)] == [
            ("Not Started", "Archived"),
            ("Archived", "In Progress"),
        ]


class TestStatusHistoryEndpoint:
    def test_lists_changes_of_one_record(self, project):
        shot = ShotFactory.create(project=project, code="S1")
        other = ShotFactory.create(project=project, code="S2")
        user = _user(project, "shot.view", "shot.update")
        client = _client(user)
        client.patch(f"/api/v1/shots/{shot.id}/", {"status": "In Progress"}, format="json")
        client.patch(f"/api/v1/shots/{other.id}/", {"status": "On Hold"}, format="json")

        resp = client.get(f"/api/v1/shots/{shot.id}/status-history/")

        assert resp.status_code == 200
        assert [(row["from_status"], row["to_status"]) for row in resp.json()] == [
            ("Not Started", "In Progress")
        ]

    def test_needs_the_view_code_and_membership(self, project):
        shot = ShotFactory.create(project=project, code="S1")
        outsider = UserFactory.create()
        grant_permissions(outsider, "shot.view")
        blind = _user(project)

        assert _client(outsider).get(f"/api/v1/shots/{shot.id}/status-history/").status_code == 404
        assert _client(blind).get(f"/api/v1/shots/{shot.id}/status-history/").status_code == 403


class TestBulkStatus:
    def test_per_item_results(self, project):
        ok = TaskFactory.create(project=project, code="T1")
        also_ok = TaskFactory.create(project=project, code="T2", status="Archived")
        missing = "00000000-0000-0000-0000-000000000000"
        user = _user(project, "task.view", "task.update")

        resp = _client(user).post(
            "/api/v1/tasks/bulk-status/",
            {"task_ids": [str(ok.id), str(also_ok.id), missing], "status": "In Progress"},
            format="json",
        )

        assert resp.status_code == 200, resp.json()
        body = resp.json()
        assert (body["success"], body["updated_count"], body["failed_count"]) == (False, 2, 1)
        assert {row["id"]: row["status"] for row in body["results"]} == {
            str(ok.id): "updated",
            str(also_ok.id): "updated",
            missing: "not_found",
        }
        assert len(_history(ok)) == 1 and len(_history(also_ok)) == 1

    def test_bulk_update_routes_status_through_the_workflow(self, project):
        fine = ShotFactory.create(project=project, code="B1")
        denied = ShotFactory.create(project=project, code="B2")
        user = _user(project, "shot.view", "shot.update")

        resp = _client(user).post(
            "/api/v1/shots/bulk-update/",
            [
                {"id": str(fine.id), "status": "In Progress"},
                {"id": str(denied.id), "status": "Approved"},
            ],
            format="json",
        )

        assert resp.status_code == 200, resp.json()
        fine.refresh_from_db()
        denied.refresh_from_db()
        assert (fine.status, denied.status) == ("In Progress", "Not Started")
        assert len(_history(fine)) == 1 and _history(denied) == []
