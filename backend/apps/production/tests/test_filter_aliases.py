"""
Contract tests for frontend list-filter aliases.

The mock matches any exact query key, so params the frontend sends must be
honored by the real API instead of silently ignored (ignored params used to
return unfiltered results):

- TasksPage: ``project_id``, ``team_id``, ``assignee_id``, ``vendor_id``
- ShotsPage: ``sequence`` (alias of ``sequence_code``)
- useProjects: ``organization_id`` (+ ``search`` matching ``client_name``)
"""

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
    TeamFactory,
)
from apps.production.tests.factories import (
    ProjectFactory,
    ShotFactory,
    TaskFactory,
)


def _org_header(org):
    return {"HTTP_X_ORGANIZATION_ID": str(org.id)}


def _member_client(org):
    """Member holding `projects:read` (membership alone grants no permissions)."""
    from apps.organization.tests.factories import (
        PermissionFactory,
        RoleFactory,
        RolePermissionFactory,
    )

    user = UserFactory.create()
    permission = PermissionFactory.create(
        code="projects:read", module="projects", action="read", is_active=True
    )
    role = RoleFactory.create(organization=org)
    RolePermissionFactory.create(role=role, permission=permission)
    OrganizationMembershipFactory.create(user=user, organization=org, role=role)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestTaskFilterAliases:
    def test_project_id_team_id_assignee_id_vendor_id(self, staff_client):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        other_project = ProjectFactory.create(organization=org)
        assignee = UserFactory.create()
        team = TeamFactory.create(organization=org)
        wanted = TaskFactory.create(
            organization=org,
            project=project,
            assignee=assignee,
            team=team,
            vendor_id="ven-001",
        )
        TaskFactory.create(organization=org, project=other_project, vendor_id="ven-002")

        cases = [
            ("project_id", str(project.id)),
            ("team_id", str(team.id)),
            ("assignee_id", str(assignee.id)),
            ("vendor_id", "VEN-001"),  # case-insensitive
        ]
        for param, value in cases:
            resp = staff_client.get(
                f"/api/v1/tasks/?{param}={value}", **_org_header(org)
            )
            assert resp.status_code == status.HTTP_200_OK, (param, resp.data)
            assert [row["code"] for row in resp.data["results"]] == [wanted.code], param

    def test_project_mock_id_and_unknown_values(self, staff_client):
        """Regression: `?project_id=proj-001` (mock id) 400ed; must resolve."""
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org, code="NK99")
        wanted = TaskFactory.create(organization=org, project=project)
        other = ProjectFactory.create(organization=org, code="AETH2")
        TaskFactory.create(organization=org, project=other)

        resp = staff_client.get("/api/v1/tasks/?project_id=proj-001", **_org_header(org))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert [row["code"] for row in resp.data["results"]] == [wanted.code]

        # Unknown values match nothing (mock exact-match semantics), never 400.
        for url in (
            "/api/v1/tasks/?project_id=proj-999",
            "/api/v1/tasks/?team_id=not-a-uuid",
            "/api/v1/tasks/?assignee_id=not-a-uuid",
        ):
            resp = staff_client.get(url, **_org_header(org))
            assert resp.status_code == status.HTTP_200_OK, (url, resp.data)
            assert resp.data["results"] == [], url

    def test_show_id_tolerated_until_show_epic(self, staff_client):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        TaskFactory.create(organization=org, project=project)

        resp = staff_client.get(
            f"/api/v1/tasks/?project_id={project.id}&is_archived=false"
            "&show_id=show-nk99-main",
            **_org_header(org),
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["count"] == 1


@pytest.mark.django_db
class TestShotSequenceAlias:
    def test_sequence_alias_matches_sequence_code(self, staff_client):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        wanted = ShotFactory.create(
            organization=org, project=project, sequence_code="NK_010"
        )
        ShotFactory.create(organization=org, project=project, sequence_code="NK_020")

        resp = staff_client.get("/api/v1/shots/?sequence=NK_010", **_org_header(org))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert [row["code"] for row in resp.data["results"]] == [wanted.code]


@pytest.mark.django_db
class TestProjectOrganizationFilterAndSearch:
    def test_search_matches_client_name(self, staff_client):
        org = OrganizationFactory.create()
        wanted = ProjectFactory.create(
            organization=org, name="Alpha", code="ALP1", client_name="Warner Nexus"
        )
        ProjectFactory.create(
            organization=org, name="Beta", code="BET1", client_name="Someone Else"
        )

        resp = staff_client.get("/api/v1/projects/?search=Warner", **_org_header(org))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert [row["code"] for row in resp.data["results"]] == [wanted.code]

    def test_organization_id_filter(self):
        org = OrganizationFactory.create()
        other = OrganizationFactory.create()
        mine = ProjectFactory.create(organization=org)
        ProjectFactory.create(organization=other)
        client = _member_client(org)

        resp = client.get(f"/api/v1/projects/?organization_id={org.id}", **_org_header(org))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert [row["code"] for row in resp.data["results"]] == [mine.code]

        # Code/slug form of the same org also matches.
        resp = client.get(
            f"/api/v1/projects/?organization_id={org.code}", **_org_header(org)
        )
        assert [row["code"] for row in resp.data["results"]] == [mine.code]

        # Foreign or unknown values fail closed (org scope is authoritative).
        resp = client.get(
            f"/api/v1/projects/?organization_id={other.id}", **_org_header(org)
        )
        assert resp.data["results"] == []
        resp = client.get("/api/v1/projects/?organization_id=nope", **_org_header(org))
        assert resp.data["results"] == []
