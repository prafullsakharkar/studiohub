"""
Bulk-task authorization: assignee/team validation, status validation, and
soft-delete semantics for bulk delete.

Assignees must hold an active membership on a project in the caller's
scope; teams resolve against the global masterdata directory.
"""

from __future__ import annotations

import uuid

import pytest

from apps.identity.tests.factories import UserFactory
from apps.masterdata.models import Team
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory, TaskFactory


@pytest.mark.django_db
class TestTaskBulkAuthorization:
    def _setup(self, staff_user):
        project = ProjectFactory.create()
        ProjectMembership.objects.create(
            user=staff_user, project=project, status="active", role="Artist"
        )
        task = TaskFactory.create(project=project)
        return project, task

    def _member(self, project, **kwargs):
        user = UserFactory.create()
        ProjectMembership.objects.create(
            user=user,
            project=project,
            status=kwargs.get("status", "active"),
            role=kwargs.get("role", "Artist"),
        )
        return user

    def test_bulk_assign_rejects_non_member_assignee(
        self, staff_client, staff_user
    ):
        _project, task = self._setup(staff_user)
        outsider = UserFactory.create()
        response = staff_client.post(
            "/api/v1/tasks/bulk-assign/",
            {"task_ids": [str(task.id)], "assignee_id": str(outsider.id)},
            format="json",
        )
        assert response.status_code == 400, response.data
        task.refresh_from_db()
        assert task.assignee_id is None

    def test_bulk_assign_accepts_member_assignee(self, staff_client, staff_user):
        project, task = self._setup(staff_user)
        member = self._member(project)
        response = staff_client.post(
            "/api/v1/tasks/bulk-assign/",
            {"task_ids": [str(task.id)], "assignee_id": str(member.id)},
            format="json",
        )
        assert response.status_code == 200, response.data
        task.refresh_from_db()
        assert task.assignee_id == member.id

    def test_bulk_assign_rejects_unknown_team(self, staff_client, staff_user):
        _project, task = self._setup(staff_user)
        response = staff_client.post(
            "/api/v1/tasks/bulk-assign/",
            {"task_ids": [str(task.id)], "team_id": str(uuid.uuid4())},
            format="json",
        )
        assert response.status_code == 400, response.data
        assert "team_id" in response.data

    def test_bulk_assign_accepts_global_team(self, staff_client, staff_user):
        from apps.masterdata.models import Department

        _project, task = self._setup(staff_user)
        department = Department.objects.create(code="TM-DEPT", name="Team Dept")
        team = Team.objects.create(
            code="TM-ASSIGN", name="Assign Team", department=department
        )
        response = staff_client.post(
            "/api/v1/tasks/bulk-assign/",
            {"task_ids": [str(task.id)], "team_id": str(team.id)},
            format="json",
        )
        assert response.status_code == 200, response.data
        task.refresh_from_db()
        assert task.team_id == team.id

    def test_bulk_status_rejects_invalid_value(self, staff_client, staff_user):
        _project, task = self._setup(staff_user)
        response = staff_client.post(
            "/api/v1/tasks/bulk-status/",
            {"task_ids": [str(task.id)], "status": "Hacked"},
            format="json",
        )
        assert response.status_code == 400, response.data
        task.refresh_from_db()
        assert task.status != "Hacked"

    def test_bulk_status_accepts_valid_value(self, staff_client, staff_user):
        _project, task = self._setup(staff_user)
        response = staff_client.post(
            "/api/v1/tasks/bulk-status/",
            {"task_ids": [str(task.id)], "status": "In Progress"},
            format="json",
        )
        assert response.status_code == 200, response.data
        task.refresh_from_db()
        assert task.status == "In Progress"

    def test_bulk_delete_soft_deletes(self, staff_client, staff_user):
        _project, task = self._setup(staff_user)
        response = staff_client.post(
            "/api/v1/tasks/bulk-delete/",
            {"task_ids": [str(task.id)]},
            format="json",
        )
        assert response.status_code == 200, response.data
        assert response.data["deleted_count"] == 1
        task.refresh_from_db()
        assert task.is_deleted is True
        # Row still exists (recoverable), hidden from the default manager.
        from apps.production.models import Task

        assert Task.all_objects.filter(id=task.id).exists()
        assert not Task.objects.filter(id=task.id).exists()
