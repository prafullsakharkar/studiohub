"""
ADR-0033 D1/D2 (Phase 8): the frontend user payload carries project/show
memberships so route guards and the canonical engine can evaluate
production scope without fixtures.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import OrganizationFactory
from apps.production.models.project_membership import ProjectMembership
from apps.production.tests.factories import ProjectFactory, ShowFactory


@pytest.mark.django_db
class TestMeProjectMemberships:
    def test_payload_includes_project_memberships(self):
        user = UserFactory.create()
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        show = ShowFactory.create(organization=org, project=project)
        ProjectMembership.objects.create(
            user=user, organization=org, project=project, show=show, status="Active"
        )
        # deleted memberships must not surface
        other_project = ProjectFactory.create(organization=org)
        ProjectMembership.objects.create(
            user=user, organization=org, project=other_project, status="Active", is_deleted=True
        )

        client = APIClient()
        client.force_authenticate(user=user)
        response = client.get("/api/v1/auth/me/")

        assert response.status_code == 200
        pms = response.data["project_memberships"]
        assert len(pms) == 1
        assert pms[0]["project_id"] == str(project.id)
        assert pms[0]["show_id"] == str(show.id)
        assert pms[0]["scope"] == "SHOW"
        assert pms[0]["status"] == "Active"

    def test_payload_empty_for_membershipless_user(self):
        user = UserFactory.create()
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.get("/api/v1/auth/me/")
        assert response.status_code == 200
        assert response.data["project_memberships"] == []
