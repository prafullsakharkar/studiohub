"""
Review pipeline RP-3: the approval roll-up (docs/review-pipeline PLAN WP 3.1, 3.2; CONTRACTS C-RP-14,
C-RP-15; Q-RP-15 to Q-RP-18 = A).

A version moving to Approved approves its task once the approval has committed, when the
version's project has ``approve_task_on_version_approval`` on. The roll-up never changes the
approval's answer.
"""

from __future__ import annotations

from unittest import mock

import pytest
from rest_framework.test import APIClient

from apps.core.events import default_event_bus
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.events.handlers import ApprovalRollupHandler
from apps.production.events.status import StatusChanged
from apps.production.models import ProjectMembership, StatusHistory, Task, Version
from apps.production.services.approval_rollup import ApprovalRollupService
from apps.production.tests.factories import (
    ProjectFactory,
    ShotFactory,
    TaskFactory,
    VersionFactory,
)

pytestmark = pytest.mark.django_db

SWITCH = "approve_task_on_version_approval"
#: an approver who may approve versions and holds no task code at all
APPROVER = ("project.view", "version.view", "version.update", "version.publish")
WORKING = ("Not Started", "In Progress", "Pending Review", "Retake")


@pytest.fixture
def project():
    return ProjectFactory.create(code="RPTHREE", approve_task_on_version_approval=True)


def _user(project, *codes):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    return user


def _api(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _version(project, code, task: Task | None = None, shot=None) -> Version:
    """A version waiting for review."""
    return VersionFactory.create(
        project=project,
        shot=shot or ShotFactory.create(project=project, code=f"{project.code}_S_{code}"),
        task=task,
        code=f"{project.code}_{code}",
        status="Pending Review",
    )


def _work(project, task_status="In Progress", code="V1") -> tuple[Version, Task]:
    """A shot, its task (made by an artist) and a version of it waiting for review."""
    shot = ShotFactory.create(project=project, code=f"{project.code}_S_{code}")
    task = TaskFactory.create(
        project=project,
        shot=shot,
        code=f"{project.code}_T_{code}",
        status=task_status,
        assignee=UserFactory.create(),
    )
    return _version(project, code, task, shot), task


def _approve(api, version, capture):
    with capture(execute=True):
        resp = api.patch(f"/api/v1/versions/{version.id}/", {"status": "Approved"}, format="json")
    assert resp.status_code == 200, resp.json()
    return resp


def _history(entity):
    return list(StatusHistory.objects.filter(entity_id=entity.pk).order_by("changed_at"))


@pytest.fixture
def status_events(monkeypatch):
    """Every StatusChanged dispatched, still delivered to its handlers."""
    seen: list[StatusChanged] = []
    dispatch = default_event_bus.dispatcher.dispatch

    def record(event):
        if isinstance(event, StatusChanged):
            seen.append(event)
        dispatch(event)

    monkeypatch.setattr(default_event_bus.dispatcher, "dispatch", record)
    return seen


class TestRollUp:
    """C-RP-15."""

    @pytest.mark.parametrize("task_status", WORKING)
    def test_approving_the_version_approves_its_task_from_any_working_state(
        self, project, task_status, django_capture_on_commit_callbacks
    ):
        version, task = _work(project, task_status)
        approver = _user(project, *APPROVER)

        _approve(_api(approver), version, django_capture_on_commit_callbacks)

        task.refresh_from_db()
        assert task.status == "Approved"
        [row] = _history(task)
        assert (row.from_status, row.to_status, row.actor, row.reason, row.override_kind) == (
            task_status,
            "Approved",
            approver,
            "Version RPTHREE_V1 approved",
            "",
        )

    def test_promote_rolls_up_too(self, project, django_capture_on_commit_callbacks):
        version, task = _work(project)
        api = _api(_user(project, *APPROVER))

        with django_capture_on_commit_callbacks(execute=True):
            resp = api.post(f"/api/v1/versions/{version.id}/promote/", {}, format="json")

        assert resp.status_code == 200, resp.json()
        task.refresh_from_db()
        assert task.status == "Approved"

    def test_switch_off_leaves_the_task_alone(self, django_capture_on_commit_callbacks):
        off = ProjectFactory.create(code="RPOFF")
        assert getattr(off, SWITCH) is False  # Q-RP-17: off by default
        version, task = _work(off)

        _approve(_api(_user(off, *APPROVER)), version, django_capture_on_commit_callbacks)

        task.refresh_from_db()
        assert task.status == "In Progress"
        assert _history(task) == []

    def test_one_project_on_does_not_switch_another_on(
        self, project, django_capture_on_commit_callbacks
    ):
        off = ProjectFactory.create(code="RPOFF")
        mine, my_task = _work(project)
        theirs, their_task = _work(off)

        _approve(_api(_user(project, *APPROVER)), mine, django_capture_on_commit_callbacks)
        _approve(_api(_user(off, *APPROVER)), theirs, django_capture_on_commit_callbacks)

        my_task.refresh_from_db()
        their_task.refresh_from_db()
        assert (my_task.status, their_task.status) == ("Approved", "In Progress")

    @pytest.mark.parametrize("task_status", ["Approved", "Archived"])
    def test_approved_and_archived_tasks_are_left_alone(
        self, project, task_status, django_capture_on_commit_callbacks
    ):
        version, task = _work(project, task_status)

        _approve(_api(_user(project, *APPROVER)), version, django_capture_on_commit_callbacks)

        task.refresh_from_db()
        assert task.status == task_status
        assert _history(task) == []

    def test_a_deleted_task_is_left_alone(self, project, django_capture_on_commit_callbacks):
        version, task = _work(project)
        Task.all_objects.filter(pk=task.pk).update(is_deleted=True)

        _approve(_api(_user(project, *APPROVER)), version, django_capture_on_commit_callbacks)

        assert Task.all_objects.get(pk=task.pk).status == "In Progress"

    def test_a_version_without_a_task_is_approved_and_nothing_else(
        self, project, django_capture_on_commit_callbacks
    ):
        version = _version(project, "V1")

        _approve(_api(_user(project, *APPROVER)), version, django_capture_on_commit_callbacks)

        version.refresh_from_db()
        assert version.status == "Approved"
        assert StatusHistory.objects.filter(entity_type="Task").count() == 0

    @pytest.mark.parametrize("to_status", ["Retake", "In Progress"])
    def test_other_version_moves_do_nothing(
        self, project, to_status, django_capture_on_commit_callbacks
    ):
        version, task = _work(project)
        api = _api(_user(project, *APPROVER))

        with django_capture_on_commit_callbacks(execute=True):
            resp = api.patch(
                f"/api/v1/versions/{version.id}/", {"status": to_status}, format="json"
            )

        assert resp.status_code == 200, resp.json()
        task.refresh_from_db()
        assert task.status == "In Progress"

    def test_leaving_approved_later_does_not_touch_the_task(
        self, project, django_capture_on_commit_callbacks
    ):
        """Q-RP-16 = A."""
        version, task = _work(project)
        api = _api(_user(project, *APPROVER))
        _approve(api, version, django_capture_on_commit_callbacks)

        with django_capture_on_commit_callbacks(execute=True):
            resp = api.patch(
                f"/api/v1/versions/{version.id}/", {"status": "Archived"}, format="json"
            )

        assert resp.status_code == 200, resp.json()
        task.refresh_from_db()
        assert task.status == "Approved"

    def test_an_older_version_counts(self, project, django_capture_on_commit_callbacks):
        """Q-RP-18 = A: any live version of the task."""
        older, task = _work(project)
        VersionFactory.create(
            project=project,
            shot=older.shot,
            task=task,
            code="RPTHREE_V2",
            status="Pending Review",
            version_index=older.version_index + 1,
        )

        _approve(_api(_user(project, *APPROVER)), older, django_capture_on_commit_callbacks)

        task.refresh_from_db()
        assert task.status == "Approved"

    def test_the_task_gets_one_status_event_and_a_second_run_changes_nothing(
        self, project, status_events, django_capture_on_commit_callbacks
    ):
        version, task = _work(project)
        approver = _user(project, *APPROVER)

        _approve(_api(approver), version, django_capture_on_commit_callbacks)
        with django_capture_on_commit_callbacks(execute=True):
            again = ApprovalRollupService.roll_up(
                version_id=str(version.pk), actor_id=str(approver.pk)
            )

        assert again is None
        assert [(e.payload["entity_type"], e.payload["to_status"]) for e in status_events] == [
            ("Version", "Approved"),
            ("Task", "Approved"),
        ]
        assert len(_history(task)) == 1

    def test_runs_only_after_the_approval_has_committed(
        self, project, django_capture_on_commit_callbacks
    ):
        version, task = _work(project)
        api = _api(_user(project, *APPROVER))

        with django_capture_on_commit_callbacks(execute=False) as pending:
            api.patch(f"/api/v1/versions/{version.id}/", {"status": "Approved"}, format="json")
            task.refresh_from_db()
            assert task.status == "In Progress"

        assert pending  # the dispatch waits for the commit

    def test_a_failure_is_logged_and_the_approval_still_answers_200(
        self, project, django_capture_on_commit_callbacks
    ):
        version, task = _work(project)

        with (
            mock.patch.object(ApprovalRollupService, "roll_up", side_effect=RuntimeError("boom")),
            mock.patch("apps.production.events.handlers.logger") as logger,
        ):
            resp = _approve(
                _api(_user(project, *APPROVER)), version, django_capture_on_commit_callbacks
            )

        assert resp.json()["status"] == "Approved"
        version.refresh_from_db()
        task.refresh_from_db()
        assert (version.status, task.status) == ("Approved", "In Progress")
        logger.exception.assert_called_once()
        assert logger.exception.call_args.args == ("approval_rollup_failed",)
        assert logger.exception.call_args.kwargs["version_id"] == str(version.pk)

    @pytest.mark.parametrize(
        ("entity_type", "to_status"),
        [("Shot", "Approved"), ("Task", "Approved"), ("Review", "Approved"), ("Version", "Retake")],
    )
    def test_only_a_version_approval_rolls_up(self, entity_type, to_status):
        event = StatusChanged(entity_type=entity_type, entity_id="x", to_status=to_status)
        with mock.patch.object(ApprovalRollupService, "roll_up") as roll_up:
            ApprovalRollupHandler().handle(event)
        roll_up.assert_not_called()

    def test_the_service_rereads_the_version(self, project):
        """A version that is no longer Approved when the roll-up runs approves nothing."""
        version, task = _work(project)
        version.status = "Retake"
        version.save(update_fields=["status"])

        assert ApprovalRollupService.roll_up(version_id=str(version.pk), actor_id=None) is None
        task.refresh_from_db()
        assert task.status == "In Progress"

    def test_the_handler_is_subscribed(self):
        assert ApprovalRollupHandler in default_event_bus.registry.handlers_for(
            StatusChanged(entity_type="Version")
        )


class TestSwitch:
    """C-RP-14."""

    def test_in_every_project_response_and_off_by_default(self):
        project = ProjectFactory.create(code="RPSW")
        reader = _user(project, "project.view")
        api = _api(reader)

        detail = api.get(f"/api/v1/projects/{project.id}/")
        listed = api.get("/api/v1/projects/")

        assert detail.status_code == 200, detail.json()
        assert detail.json()[SWITCH] is False
        rows = listed.json()["results"] if isinstance(listed.json(), dict) else listed.json()
        assert [row[SWITCH] for row in rows if row["id"] == str(project.id)] == [False]

    def test_written_with_project_update(self):
        project = ProjectFactory.create(code="RPSW")
        api = _api(_user(project, "project.view", "project.update"))

        resp = api.patch(f"/api/v1/projects/{project.id}/", {SWITCH: True}, format="json")

        assert resp.status_code == 200, resp.json()
        assert resp.json()[SWITCH] is True
        project.refresh_from_db()
        assert project.approve_task_on_version_approval is True

    def test_refused_without_project_update(self):
        project = ProjectFactory.create(code="RPSW")
        api = _api(_user(project, "project.view"))

        resp = api.patch(f"/api/v1/projects/{project.id}/", {SWITCH: True}, format="json")

        assert resp.status_code == 403
        project.refresh_from_db()
        assert project.approve_task_on_version_approval is False

    def test_not_a_boolean_is_a_field_error(self):
        project = ProjectFactory.create(code="RPSW")
        api = _api(_user(project, "project.view", "project.update"))

        resp = api.patch(f"/api/v1/projects/{project.id}/", {SWITCH: "sometimes"}, format="json")

        assert resp.status_code == 400
        assert SWITCH in resp.json()

    def test_set_on_create(self):
        creator = UserFactory.create()
        grant_permissions(creator, "project.view", "project.create")

        resp = _api(creator).post(
            "/api/v1/projects/",
            {
                "code": "RPNEW",
                "name": "New",
                "workflow_type": "standard",
                "type": "Feature Film",
                SWITCH: True,
            },
            format="json",
        )

        assert resp.status_code == 201, resp.json()
        assert resp.json()[SWITCH] is True
