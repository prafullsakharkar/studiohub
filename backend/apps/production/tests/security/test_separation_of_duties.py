"""
Separation of duties: nobody approves work they produced (WP D4 follow-up).

Covered on every path that can approve: the action, a plain PATCH of the status,
the verdict actions, promote, a scoped API key / token, and the service itself
(what a bulk loop would call). Producers are found from the record and the work
it points at, including whoever was the task's assignee earlier, so reassigning
the task before approving does not help. ``production.sod.override`` lets the
producer through with a reason and leaves a ``StatusHistory`` row; it is granted
by role only, superuser does not imply it, and a scoped credential needs it in
its scopes.
"""

from __future__ import annotations

import uuid

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.identity.services.credential import API_KEY, PERSONAL_ACCESS_TOKEN, CredentialService
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.exceptions import SeparationOfDuties
from apps.production.models import ProjectMembership, StatusHistory, Timelog
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

SOD = "production.sod.override"


@pytest.fixture
def project():
    return ProjectFactory.create(code="SOD01")


def _user(project, *codes, **fields):
    user = UserFactory.create(**fields)
    if codes:
        grant_permissions(user, *codes)
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _as_credential(kind, owner, scopes):
    _, secret = CredentialService.create(kind=kind, owner=owner, name="t", scopes=list(scopes))
    client = APIClient()
    client.credentials(
        HTTP_AUTHORIZATION=f"{'Token' if kind == PERSONAL_ACCESS_TOKEN else 'Api-Key'} {secret}"
    )
    return client


def _post(user, path, body=None):
    return _client(user).post(path, body or {}, format="json")


def _patch(user, path, body):
    return _client(user).patch(path, body, format="json")


TIMELOG_CODES = ("timelog.view", "timelog.view_all", "timelog.approve")
REVIEW_CODES = ("review.view", "review.update", "review.approve")
VERSION_CODES = ("version.view", "version.update", "version.publish")


def _timelog(project, person, **extra):
    return TimelogFactory.create(
        task=TaskFactory.create(project=project, code="T1"), person=person, **extra
    )


class TestTimelog:
    def test_the_person_cannot_approve_or_reject_their_own_time(self, project):
        owner = _user(project, *TIMELOG_CODES)
        log = _timelog(project, owner)

        approve = _post(owner, f"/api/v1/timelogs/{log.id}/approve/")
        reject = _post(owner, f"/api/v1/timelogs/{log.id}/reject/", {"rejection_reason": "no"})

        assert approve.status_code == reject.status_code == status.HTTP_403_FORBIDDEN
        log.refresh_from_db()
        assert log.status == "Submitted"
        assert not StatusHistory.objects.filter(entity_id=log.id).exists()

    def test_whoever_created_the_entry_cannot_approve_it_either(self, project):
        manager = _user(project, *TIMELOG_CODES, "timelog.manage", "timelog.create")
        staff = _user(project)
        created = _post(
            manager,
            "/api/v1/timelogs/",
            {
                "task": str(TaskFactory.create(project=project, code="T9").id),
                "person": str(staff.id),
                "duration_hours": "3.00",
                "date": "2026-10-26",
            },
        )
        assert created.status_code == 201, created.json()
        log = Timelog.objects.get(id=created.json()["id"])

        assert _post(manager, f"/api/v1/timelogs/{log.id}/approve/").status_code == 403
        assert (
            _post(_user(project, *TIMELOG_CODES), f"/api/v1/timelogs/{log.id}/approve/").status_code
            == 200
        )

    def test_a_plain_status_patch_is_checked_too(self, project):
        owner = _user(project, "timelog.view", "timelog.update", "timelog.approve")
        log = _timelog(project, owner)

        resp = _patch(owner, f"/api/v1/timelogs/{log.id}/", {"status": "Approved"})

        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_someone_else_can_approve(self, project):
        owner = _user(project)
        log = _timelog(project, owner)

        assert (
            _post(_user(project, *TIMELOG_CODES), f"/api/v1/timelogs/{log.id}/approve/").status_code
            == 200
        )

    def test_the_service_refuses_for_every_row_of_a_loop(self, project):
        # What a bulk endpoint would call: each item is checked on its own.
        owner = _user(project)
        logs = [_timelog(project, owner) for _ in range(3)]

        for log in logs:
            with pytest.raises(SeparationOfDuties):
                StatusService.transition_status(
                    actor=owner,
                    entity=log,
                    to_status="Approved",
                    has_permission=lambda code: True,
                )
        assert Timelog.objects.filter(status="Approved").count() == 0

    def test_no_bulk_endpoint_reaches_approvals(self, project):
        user = _user(project, *TIMELOG_CODES, *REVIEW_CODES, *VERSION_CODES)
        for resource in ("timelogs", "reviews", "versions"):
            assert _post(
                user,
                f"/api/v1/{resource}/bulk-update/",
                {"ids": [], "changes": {"status": "Approved"}},
            ).status_code in (404, 405)


class TestOverride:
    def test_override_with_a_reason_lets_the_producer_through_and_is_recorded(self, project):
        owner = _user(project, *TIMELOG_CODES, SOD)
        log = _timelog(project, owner)

        resp = _post(
            owner, f"/api/v1/timelogs/{log.id}/approve/", {"override_reason": "sole accountant"}
        )

        assert resp.status_code == 200, resp.json()
        (row,) = StatusHistory.objects.filter(entity_id=log.id)
        assert (row.override_kind, row.reason, row.actor) == (
            "self_approval",
            "sole accountant",
            owner,
        )

    def test_override_without_a_reason_is_refused(self, project):
        owner = _user(project, *TIMELOG_CODES, SOD)
        log = _timelog(project, owner)

        resp = _post(owner, f"/api/v1/timelogs/{log.id}/approve/", {"override_reason": "  "})

        assert resp.status_code == status.HTTP_403_FORBIDDEN
        log.refresh_from_db()
        assert log.status == "Submitted"

    def test_a_reason_without_the_permission_does_nothing(self, project):
        owner = _user(project, *TIMELOG_CODES)
        log = _timelog(project, owner)

        resp = _post(owner, f"/api/v1/timelogs/{log.id}/approve/", {"override_reason": "please"})

        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_superuser_does_not_imply_the_override(self, project):
        owner = _user(project, is_superuser=True)
        log = _timelog(project, owner)

        resp = _post(
            owner, f"/api/v1/timelogs/{log.id}/approve/", {"override_reason": "break glass"}
        )

        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_no_seeded_role_holds_the_override_codes(self):
        from apps.core.management.commands.init_platform import (
            PERMISSION_SPECS,
            ROLE_SPECS,
            Command,
        )

        in_catalog = {spec[0] for spec in PERMISSION_SPECS}
        assert {SOD, "production.status.override"} <= in_catalog  # grantable by an admin
        matrix = Command()._role_perm_matrix({code: object() for code in in_catalog})
        for role in ROLE_SPECS:
            assert not {SOD, "production.status.override"} & set(matrix[role["code"]]), role["code"]


class TestReview:
    def _submitted_by(self, project, owner, **extra):
        review = ReviewFactory.create(project=project, status="Pending Review", **extra)
        assert _post(owner, f"/api/v1/reviews/{review.id}/submit/").status_code == 200
        assert _post(owner, f"/api/v1/reviews/{review.id}/start-review/").status_code == 200
        review.refresh_from_db()
        return review

    def test_the_session_creator_who_leads_it_may_approve(self, project):
        # Reviews are set up by the reviewer (lead_reviewer = creator); that is not producing the work.
        lead = _user(project, *REVIEW_CODES, "review.create")
        created = _post(
            lead, "/api/v1/reviews/", {"project": str(project.id), "title": "Dailies", "code": "D1"}
        )
        assert created.status_code == 201, created.json()
        review = ReviewFactory._meta.model.objects.get(id=created.json()["id"])
        review.status = "In Review"
        review.save()

        assert _post(lead, f"/api/v1/reviews/{review.id}/approve/").status_code == 200

    def test_whoever_submitted_the_review_cannot_approve_it_on_any_path(self, project):
        owner = _user(project, *REVIEW_CODES)
        review = self._submitted_by(project, owner)
        base = f"/api/v1/reviews/{review.id}/"

        assert _post(owner, base + "approve/").status_code == 403
        assert _patch(owner, base, {"status": "Approved"}).status_code == 403
        assert _post(owner, base + "verdict/", {"verdict": "Approved"}).status_code == 403
        review.refresh_from_db()
        assert (review.status, review.supervisor_verdict) == ("In Review", "Pending Review")

    def test_a_verdict_on_an_already_approved_review_is_checked_too(self, project):
        owner = _user(project, *REVIEW_CODES)
        review = self._submitted_by(project, owner)
        StatusService.transition_status(
            actor=_user(project), entity=review, to_status="Approved", enforce=False
        )

        assert (
            _post(
                owner, f"/api/v1/reviews/{review.id}/verdict/", {"verdict": "Approved"}
            ).status_code
            == 403
        )

    def test_a_participant_verdict_is_checked(self, project):
        owner = _user(project, *REVIEW_CODES)
        review = self._submitted_by(project, owner, reviewers=[{"id": "p1", "name": "Me"}])

        resp = _post(
            owner,
            f"/api/v1/reviews/{review.id}/participant-verdict/",
            {"participant_id": "p1", "verdict": "Approved"},
        )

        assert resp.status_code == 403

    def test_the_artist_of_the_reviewed_version_cannot_approve_the_review(self, project):
        artist = _user(project, *REVIEW_CODES)
        version = VersionFactory.create(project=project, code="V1", artist=artist)
        review = ReviewFactory.create(
            project=project, status="In Review", entity_type="Version", entity_id=str(version.id)
        )

        assert _post(artist, f"/api/v1/reviews/{review.id}/approve/").status_code == 403
        assert (
            _post(
                _user(project, *REVIEW_CODES), f"/api/v1/reviews/{review.id}/approve/"
            ).status_code
            == 200
        )

    def test_reassigning_the_task_first_does_not_clear_the_approver(self, project):
        worker = _user(project, *REVIEW_CODES, "task.view", "task.update")
        successor = _user(project)
        task = TaskFactory.create(project=project, code="T1", assignee=worker)
        task.assignee = worker
        task.save()
        version = VersionFactory.create(project=project, code="V1", task=task)
        review = ReviewFactory.create(
            project=project, status="In Review", entity_type="Version", entity_id=str(version.id)
        )

        moved = _patch(worker, f"/api/v1/tasks/{task.id}/", {"assignee": str(successor.id)})
        assert moved.status_code == 200, moved.json()

        assert _post(worker, f"/api/v1/reviews/{review.id}/approve/").status_code == 403

    def test_override_is_recorded_for_a_review(self, project):
        owner = _user(project, *REVIEW_CODES, SOD)
        review = self._submitted_by(project, owner)

        resp = _post(
            owner,
            f"/api/v1/reviews/{review.id}/approve/",
            {"notes": "ok", "override_reason": "solo studio"},
        )

        assert resp.status_code == 200, resp.json()
        assert (
            StatusHistory.objects.get(entity_id=review.id, to_status="Approved").override_kind
            == "self_approval"
        )


def _shot(project):
    """A shot of its own: a hero version belongs to a shot or an asset."""
    return ShotFactory.create(project=project, code=f"S{uuid.uuid4().hex[:8]}")


class TestVersion:
    def test_the_artist_cannot_approve_their_version(self, project):
        artist = _user(project, *VERSION_CODES)
        version = VersionFactory.create(
            shot=_shot(project), project=project, code="V1", artist=artist, status="Pending Review"
        )
        base = f"/api/v1/versions/{version.id}/"

        assert _patch(artist, base, {"status": "Approved"}).status_code == 403
        assert _post(artist, base + "promote/").status_code == 403
        version.refresh_from_db()
        assert (version.status, version.is_hero) == ("Pending Review", False)

    def test_whoever_created_the_version_cannot_approve_it(self, project):
        creator = _user(project, *VERSION_CODES)
        version = VersionFactory.create(
            shot=_shot(project),
            project=project,
            code="V1",
            created_by=creator,
            status="Pending Review",
        )

        assert _post(creator, f"/api/v1/versions/{version.id}/promote/").status_code == 403

    def test_promoting_an_already_approved_version_is_checked(self, project):
        artist = _user(project, *VERSION_CODES)
        version = VersionFactory.create(
            shot=_shot(project), project=project, code="V1", artist=artist, status="Approved"
        )

        assert _post(artist, f"/api/v1/versions/{version.id}/promote/").status_code == 403
        version.refresh_from_db()
        assert version.is_hero is False

    def test_reassigning_the_task_first_does_not_clear_the_approver(self, project):
        worker = _user(project, *VERSION_CODES, "task.view", "task.update")
        successor = _user(project)
        task = TaskFactory.create(project=project, code="T1", assignee=worker)
        task.assignee = worker
        task.save()
        version = VersionFactory.create(
            shot=_shot(project), project=project, code="V1", task=task, status="Pending Review"
        )
        _patch(worker, f"/api/v1/tasks/{task.id}/", {"assignee": str(successor.id)})

        assert _post(worker, f"/api/v1/versions/{version.id}/promote/").status_code == 403

    def test_someone_else_can_approve_and_promote(self, project):
        artist = _user(project)
        version = VersionFactory.create(
            shot=_shot(project), project=project, code="V1", artist=artist, status="Pending Review"
        )

        resp = _post(_user(project, *VERSION_CODES), f"/api/v1/versions/{version.id}/promote/")

        assert resp.status_code == 200, resp.json()

    def test_override_on_an_already_approved_version_leaves_a_row(self, project):
        artist = _user(project, *VERSION_CODES, SOD)
        version = VersionFactory.create(
            shot=_shot(project), project=project, code="V1", artist=artist, status="Approved"
        )

        resp = _post(artist, f"/api/v1/versions/{version.id}/promote/", {"override_reason": "solo"})

        assert resp.status_code == 200, resp.json()
        (row,) = StatusHistory.objects.filter(entity_id=version.id)
        assert (row.override_kind, row.from_status, row.to_status) == (
            "self_approval",
            "Approved",
            "Approved",
        )


@pytest.mark.parametrize("kind", [PERSONAL_ACCESS_TOKEN, API_KEY])
class TestCredentials:
    def test_a_credential_acts_as_its_owner(self, project, kind):
        owner = _user(project, *TIMELOG_CODES)
        log = _timelog(project, owner)
        client = _as_credential(
            kind, owner, ["timelog.approve", "timelog.view", "timelog.view_all"]
        )

        assert (
            client.post(f"/api/v1/timelogs/{log.id}/approve/", {}, format="json").status_code == 403
        )

    def test_the_owners_override_does_not_pass_through_a_credential_without_it(self, project, kind):
        owner = _user(project, *TIMELOG_CODES, SOD)
        log = _timelog(project, owner)
        client = _as_credential(
            kind, owner, ["timelog.approve", "timelog.view", "timelog.view_all"]
        )

        resp = client.post(
            f"/api/v1/timelogs/{log.id}/approve/", {"override_reason": "scoped"}, format="json"
        )

        assert resp.status_code == 403
        log.refresh_from_db()
        assert log.status == "Submitted"

    def test_a_credential_scoped_with_the_override_may_use_it(self, project, kind):
        owner = _user(project, *TIMELOG_CODES, SOD)
        log = _timelog(project, owner)
        client = _as_credential(
            kind, owner, ["timelog.approve", "timelog.view", "timelog.view_all", SOD]
        )

        resp = client.post(
            f"/api/v1/timelogs/{log.id}/approve/", {"override_reason": "scoped"}, format="json"
        )

        assert resp.status_code == 200, resp.json()
