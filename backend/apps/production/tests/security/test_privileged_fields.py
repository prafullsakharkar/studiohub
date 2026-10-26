"""
Privileged fields cannot be changed through plain create/update
(analysis finding F-H1, WP A2).

Two kinds of protection:

* locked fields (``supervisor_approved``, ``is_published``, ``is_hero``,
  ``supervisor_verdict``, ``is_archived``, ``logged_hours``) have a dedicated
  action; sending a different value is a 400, echoing the stored one is ignored;
* privileged values (a status of ``Approved`` ...) stay writable but need the
  code of the matching action on top of ``*.update`` (403 otherwise).
"""

from __future__ import annotations

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership
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
    return ProjectFactory.create(code="PRIV01")


def _user(project, *codes):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _patch(user, path, body):
    return _client(user).patch(path, body, format="json")


def _post(user, path, body):
    return _client(user).post(path, body, format="json")


class TestShot:
    def path(self, shot):
        return f"/api/v1/shots/{shot.id}/"

    def test_supervisor_approved_is_locked(self, project):
        shot = ShotFactory.create(project=project, code="S1")
        user = _user(project, "shot.view", "shot.update", "shot.approve")

        resp = _patch(user, self.path(shot), {"supervisor_approved": True})

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "supervisor_approved" in resp.data
        shot.refresh_from_db()
        assert shot.supervisor_approved is False

    def test_echoing_the_stored_value_is_accepted(self, project):
        shot = ShotFactory.create(project=project, code="S1")
        user = _user(project, "shot.view", "shot.update")

        resp = _patch(user, self.path(shot), {"supervisor_approved": False, "name": "Renamed"})

        assert resp.status_code == status.HTTP_200_OK, resp.data
        shot.refresh_from_db()
        assert shot.name == "Renamed"

    def test_update_code_alone_cannot_approve_by_status(self, project):
        shot = ShotFactory.create(project=project, code="S1", status="Pending Review")
        user = _user(project, "shot.view", "shot.update")

        resp = _patch(user, self.path(shot), {"status": "Approved"})

        assert resp.status_code == status.HTTP_403_FORBIDDEN
        shot.refresh_from_db()
        assert shot.status != "Approved"

    def test_approve_code_may_set_approved_status(self, project):
        shot = ShotFactory.create(project=project, code="S1", status="Pending Review")
        user = _user(project, "shot.view", "shot.update", "shot.approve")

        resp = _patch(user, self.path(shot), {"status": "Approved"})

        assert resp.status_code == status.HTTP_200_OK, resp.data

    def test_reopening_an_approved_shot_needs_the_approve_code(self, project):
        shot = ShotFactory.create(project=project, code="S1", status="Approved")
        user = _user(project, "shot.view", "shot.update")

        assert _patch(user, self.path(shot), {"status": "Archived"}).status_code == 403

    def test_ordinary_status_changes_stay_open(self, project):
        shot = ShotFactory.create(project=project, code="S1")
        user = _user(project, "shot.view", "shot.update")

        resp = _patch(user, self.path(shot), {"status": "In Progress"})

        assert resp.status_code == status.HTTP_200_OK, resp.data

    def test_pipeline_step_cannot_be_approved_without_the_code(self, project):
        shot = ShotFactory.create(project=project, code="S1")
        user = _user(project, "shot.view", "shot.update")

        assert (
            _patch(user, self.path(shot), {"pipeline": {"layout": "Approved"}}).status_code == 403
        )
        assert (
            _patch(user, self.path(shot), {"pipeline": {"layout": "In Progress"}}).status_code
            == 200
        )

    def test_client_approval_needs_the_approve_code(self, project):
        shot = ShotFactory.create(project=project, code="S1")
        plain = _user(project, "shot.view", "shot.update")
        approver = _user(project, "shot.view", "shot.update", "shot.approve")

        assert _patch(plain, self.path(shot), {"client_approved": True}).status_code == 403
        assert _patch(approver, self.path(shot), {"client_approved": True}).status_code == 200

    def test_create_cannot_start_approved(self, project):
        body = {"project_id": str(project.id), "code": "S9", "name": "New"}
        plain = _user(project, "shot.view", "shot.create")
        approver = _user(project, "shot.view", "shot.create", "shot.approve")

        assert (
            _post(plain, "/api/v1/shots/", {**body, "supervisor_approved": True}).status_code == 400
        )
        assert _post(plain, "/api/v1/shots/", {**body, "status": "Approved"}).status_code == 403
        assert _post(approver, "/api/v1/shots/", {**body, "status": "Approved"}).status_code == 201

    def test_bulk_update_applies_the_same_rules_per_item(self, project):
        locked = ShotFactory.create(project=project, code="B1")
        guarded = ShotFactory.create(project=project, code="B2")
        fine = ShotFactory.create(project=project, code="B3")
        user = _user(project, "shot.view", "shot.update")

        resp = _post(
            user,
            "/api/v1/shots/bulk-update/",
            [
                {"id": str(locked.id), "supervisor_approved": True},
                {"id": str(guarded.id), "status": "Approved"},
                {"id": str(fine.id), "name": "Fine"},
            ],
        )

        assert resp.status_code == status.HTTP_200_OK, resp.data
        for shot in (locked, guarded, fine):
            shot.refresh_from_db()
        assert (locked.supervisor_approved, guarded.status) == (False, "Not Started")
        assert fine.name == "Fine"


class TestVersion:
    def path(self, version):
        return f"/api/v1/versions/{version.id}/"

    @pytest.mark.parametrize(("field", "value"), [("is_published", True), ("is_hero", True)])
    def test_locked_fields(self, project, field, value):
        version = VersionFactory.create(project=project, code="V1")
        user = _user(project, "version.view", "version.update", "version.publish")

        resp = _patch(user, self.path(version), {field: value})

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert field in resp.data
        version.refresh_from_db()
        assert getattr(version, field) is False

    def test_create_cannot_start_published(self, project):
        user = _user(project, "version.view", "version.create", "version.publish")

        resp = _post(
            user,
            "/api/v1/versions/",
            {"project_id": str(project.id), "code": "V2", "is_published": True},
        )

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "is_published" in resp.data

    def test_approved_status_needs_the_publish_code(self, project):
        version = VersionFactory.create(project=project, code="V1", status="Pending Review")
        plain = _user(project, "version.view", "version.update")
        publisher = _user(project, "version.view", "version.update", "version.publish")

        assert _patch(plain, self.path(version), {"status": "Approved"}).status_code == 403
        assert _patch(publisher, self.path(version), {"status": "Approved"}).status_code == 200

    def test_publish_action_still_works(self, project):
        version = VersionFactory.create(project=project, code="V1", status="Approved")
        user = _user(project, "version.view", "version.publish")

        resp = _post(user, self.path(version) + "publish/", {"comment": "ship it"})

        assert resp.status_code == status.HTTP_200_OK, resp.data
        version.refresh_from_db()
        assert version.is_published is True
        assert version.publishing_info["comment"] == "ship it"
        assert version.publishing_info["published_at"]


class TestReview:
    def path(self, review):
        return f"/api/v1/reviews/{review.id}/"

    def test_verdict_is_locked(self, project):
        review = ReviewFactory.create(project=project)
        user = _user(project, "review.view", "review.update", "review.approve")

        resp = _patch(user, self.path(review), {"supervisor_verdict": "Approved"})

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "supervisor_verdict" in resp.data

    @pytest.mark.parametrize("value", ["Approved", "Rejected", "Changes Requested", "Retake"])
    def test_decision_statuses_need_the_approve_code(self, project, value):
        review = ReviewFactory.create(project=project, status="In Review")
        plain = _user(project, "review.view", "review.update")
        approver = _user(project, "review.view", "review.update", "review.approve")

        assert _patch(plain, self.path(review), {"status": value}).status_code == 403
        assert _patch(approver, self.path(review), {"status": value}).status_code == 200

    def test_ordinary_status_stays_open(self, project):
        review = ReviewFactory.create(project=project)
        user = _user(project, "review.view", "review.update")

        assert _patch(user, self.path(review), {"status": "In Review"}).status_code == 200


class TestTask:
    def path(self, task):
        return f"/api/v1/tasks/{task.id}/"

    def test_archive_flag_and_logged_hours_are_locked(self, project):
        task = TaskFactory.create(project=project, code="T1")
        user = _user(project, "task.view", "task.update")

        archived = _patch(user, self.path(task), {"is_archived": True})
        hours = _patch(user, self.path(task), {"logged_hours": "40.00"})

        assert archived.status_code == hours.status_code == status.HTTP_400_BAD_REQUEST
        assert "is_archived" in archived.data and "logged_hours" in hours.data
        task.refresh_from_db()
        assert task.is_archived is False

    def test_echoing_stored_values_is_accepted(self, project):
        task = TaskFactory.create(project=project, code="T1")
        user = _user(project, "task.view", "task.update")

        resp = _patch(user, self.path(task), {"is_archived": False, "title": "Renamed"})

        assert resp.status_code == status.HTTP_200_OK, resp.data

    def test_archive_action_still_works(self, project):
        task = TaskFactory.create(project=project, code="T1")
        user = _user(project, "task.view", "task.update")

        assert _post(user, self.path(task) + "archive/", {}).status_code == status.HTTP_200_OK


class TestTimelog:
    def test_approved_status_needs_the_approve_code(self, project):
        owner = _user(project, "timelog.view", "timelog.update")
        log = TimelogFactory.create(
            task=TaskFactory.create(project=project, code="T1"), person=owner
        )

        resp = _patch(owner, f"/api/v1/timelogs/{log.id}/", {"status": "Approved"})

        assert resp.status_code == status.HTTP_403_FORBIDDEN
        log.refresh_from_db()
        assert log.status != "Approved"

    def test_nobody_approves_their_own_timelog(self, project):
        approver = _user(project, "timelog.view", "timelog.approve")
        log = TimelogFactory.create(
            task=TaskFactory.create(project=project, code="T1"), person=approver
        )

        assert _post(approver, f"/api/v1/timelogs/{log.id}/approve/", {}).status_code == 403
        reject = _post(approver, f"/api/v1/timelogs/{log.id}/reject/", {"rejection_reason": "no"})
        assert reject.status_code == 403

    def test_someone_else_can_approve(self, project):
        owner = UserFactory.create()
        approver = _user(project, "timelog.view", "timelog.view_all", "timelog.approve")
        log = TimelogFactory.create(
            task=TaskFactory.create(project=project, code="T1"), person=owner
        )

        resp = _post(approver, f"/api/v1/timelogs/{log.id}/approve/", {})

        assert resp.status_code == status.HTTP_200_OK, resp.data
        log.refresh_from_db()
        assert log.status == "Approved"
