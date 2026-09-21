"""
Bulk-task authorization: assignee/team validation, status validation, and
soft-delete semantics for bulk delete.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
    TeamFactory,
)
from apps.organization.tests.rbac_helpers import grant_all_known_codes
from apps.production.tests.factories import ProjectFactory, TaskFactory


def _hdr(org):
    return {"HTTP_X_ORGANIZATION_ID": str(org.id)}


@pytest.mark.django_db
class TestTaskBulkAuthorization:
    def _setup(self):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        staff = UserFactory.create(is_staff=True)
        grant_all_known_codes(staff)
        client = APIClient()
        client.force_authenticate(user=staff)
        task = TaskFactory.create(organization=org, project=project)
        return org, project, client, task

    def test_bulk_assign_rejects_non_member_assignee(self):
        org, project, client, task = self._setup()
        outsider = UserFactory.create()
        response = client.post(
            "/api/v1/tasks/bulk-assign/",
            {"task_ids": [str(task.id)], "assignee_id": str(outsider.id)},
            format="json",
            **_hdr(org),
        )
        assert response.status_code == 400, response.data
        task.refresh_from_db()
        assert task.assignee_id is None

    def test_bulk_assign_accepts_member_assignee(self):
        org, project, client, task = self._setup()
        member = UserFactory.create()
        OrganizationMembershipFactory.create(user=member, organization=org)
        response = client.post(
            "/api/v1/tasks/bulk-assign/",
            {"task_ids": [str(task.id)], "assignee_id": str(member.id)},
            format="json",
            **_hdr(org),
        )
        assert response.status_code == 200, response.data
        task.refresh_from_db()
        assert task.assignee_id == member.id

    def test_bulk_assign_rejects_foreign_team(self):
        org, project, client, task = self._setup()
        other_org = OrganizationFactory.create()
        foreign_team = TeamFactory.create(organization=other_org)
        response = client.post(
            "/api/v1/tasks/bulk-assign/",
            {"task_ids": [str(task.id)], "team_id": str(foreign_team.id)},
            format="json",
            **_hdr(org),
        )
        assert response.status_code == 400, response.data

    def test_bulk_status_rejects_invalid_value(self):
        org, project, client, task = self._setup()
        response = client.post(
            "/api/v1/tasks/bulk-status/",
            {"task_ids": [str(task.id)], "status": "Hacked"},
            format="json",
            **_hdr(org),
        )
        assert response.status_code == 400, response.data
        task.refresh_from_db()
        assert task.status != "Hacked"

    def test_bulk_status_accepts_valid_value(self):
        org, project, client, task = self._setup()
        response = client.post(
            "/api/v1/tasks/bulk-status/",
            {"task_ids": [str(task.id)], "status": "In Progress"},
            format="json",
            **_hdr(org),
        )
        assert response.status_code == 200, response.data
        task.refresh_from_db()
        assert task.status == "In Progress"

    def test_bulk_delete_soft_deletes(self):
        org, project, client, task = self._setup()
        response = client.post(
            "/api/v1/tasks/bulk-delete/",
            {"task_ids": [str(task.id)]},
            format="json",
            **_hdr(org),
        )
        assert response.status_code == 200, response.data
        assert response.data["deleted_count"] == 1
        task.refresh_from_db()
        assert task.is_deleted is True
        # Row still exists (recoverable), hidden from the default manager.
        from apps.production.models import Task

        assert Task.all_objects.filter(id=task.id).exists()
        assert not Task.objects.filter(id=task.id).exists()
