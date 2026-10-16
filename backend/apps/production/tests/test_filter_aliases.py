"""
Contract tests for frontend list-filter aliases.

The mock matches any exact query key, so params the frontend sends must be
honored by the real API instead of silently ignored (ignored params used to
return unfiltered results):

- TasksPage: ``project_id``, ``team_id``, ``assignee_id``, ``vendor_id``
- ShotsPage: ``sequence`` (alias of ``sequence_code``)
- useProjects: ``search`` matching ``client_name`` (the legacy
  ``organization_id`` param is tolerated but no longer constrains — scoping
  is by project membership only)
"""

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.masterdata.models import Department, Team
from apps.production.models import ProjectMembership
from apps.production.tests.factories import (
    AssetFactory,
    ProjectFactory,
    SequenceFactory,
    ShotFactory,
    TaskFactory,
)


def _member(user, project):
    return ProjectMembership.objects.create(
        user=user, project=project, status="active", role="Artist"
    )


def _member_client():
    """Member holding `project.view` via a platform-global grant."""
    user = UserFactory.create()
    grant_permissions(user, "project.view")
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


def _team(code="TM-FILT", name="Filter Team"):
    department, _ = Department.objects.get_or_create(
        code="DEPT-FILT", defaults={"name": "Filter Dept"}
    )
    return Team.objects.create(code=code, name=name, department=department)


@pytest.mark.django_db
class TestTaskFilterAliases:
    def test_project_id_team_id_assignee_id_vendor_id(
        self, staff_client, staff_user
    ):
        project = ProjectFactory.create()
        other_project = ProjectFactory.create()
        _member(staff_user, project)
        _member(staff_user, other_project)
        assignee = UserFactory.create()
        team = _team()
        wanted = TaskFactory.create(
            project=project,
            assignee=assignee,
            team=team,
            vendor_id="ven-001",
        )
        TaskFactory.create(project=other_project, vendor_id="ven-002")

        cases = [
            ("project_id", str(project.id)),
            ("team_id", str(team.id)),
            ("assignee_id", str(assignee.id)),
            ("vendor_id", "VEN-001"),  # case-insensitive
        ]
        for param, value in cases:
            resp = staff_client.get(f"/api/v1/tasks/?{param}={value}")
            assert resp.status_code == status.HTTP_200_OK, (param, resp.data)
            assert [row["code"] for row in resp.data["results"]] == [wanted.code], param

    def test_project_mock_id_and_unknown_values(self, staff_client, staff_user):
        """Regression: `?project_id=proj-001` (mock id) 400ed; must resolve."""
        project = ProjectFactory.create(code="NK99")
        _member(staff_user, project)
        wanted = TaskFactory.create(project=project)
        other = ProjectFactory.create(code="AETH2")
        TaskFactory.create(project=other)

        resp = staff_client.get("/api/v1/tasks/?project_id=proj-001")
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert [row["code"] for row in resp.data["results"]] == [wanted.code]

        # Unknown values match nothing (mock exact-match semantics), never 400.
        for url in (
            "/api/v1/tasks/?project_id=proj-999",
            "/api/v1/tasks/?team_id=not-a-uuid",
            "/api/v1/tasks/?assignee_id=not-a-uuid",
        ):
            resp = staff_client.get(url)
            assert resp.status_code == status.HTTP_200_OK, (url, resp.data)
            assert resp.data["results"] == [], url

    def test_show_id_tolerated_until_show_epic(self, staff_client, staff_user):
        project = ProjectFactory.create()
        _member(staff_user, project)
        TaskFactory.create(project=project)

        resp = staff_client.get(
            f"/api/v1/tasks/?project_id={project.id}&is_archived=false"
            "&show_id=show-nk99-main",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["count"] == 1


@pytest.mark.django_db
class TestShotSequenceAlias:
    def test_sequence_alias_matches_sequence_code(self, staff_client, staff_user):
        project = ProjectFactory.create()
        _member(staff_user, project)
        wanted = ShotFactory.create(project=project, sequence_code="NK_010")
        ShotFactory.create(project=project, sequence_code="NK_020")

        resp = staff_client.get("/api/v1/shots/?sequence=NK_010")
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert [row["code"] for row in resp.data["results"]] == [wanted.code]


@pytest.mark.django_db
class TestProjectSearch:
    def test_search_matches_client_name(self, staff_client, staff_user):
        wanted = ProjectFactory.create(
            name="Alpha", code="ALP1", client_name="Warner Nexus"
        )
        ProjectFactory.create(
            name="Beta", code="BET1", client_name="Someone Else"
        )
        _member(staff_user, wanted)

        resp = staff_client.get("/api/v1/projects/?search=Warner")
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert [row["code"] for row in resp.data["results"]] == [wanted.code]

    def test_legacy_organization_id_param_is_ignored(self):
        # ADR: scoping is by project membership only; a stale
        # `organization_id` param must not error and must not constrain.
        mine = ProjectFactory.create()
        ProjectFactory.create()
        client, user = _member_client()
        # ADR-0033 D1: permission grants alone show no production data;
        # per-project visibility requires an explicit ProjectMembership.
        ProjectMembership.objects.create(
            project=mine, user=user, status="active"
        )

        resp = client.get("/api/v1/projects/?organization_id=nope")
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert [row["code"] for row in resp.data["results"]] == [mine.code]


@pytest.mark.django_db
class TestProjectIdAliasAcrossResources:
    """
    Regression: list hooks send ``?project_id=<uuid>`` (plus ``show_id``), but
    several production filtersets only declared ``project`` (UUIDFilter), so the
    ``project_id`` param was silently ignored and the list returned unfiltered
    rows from every project. Every project-scoped filterset must honor both
    ``project`` and ``project_id`` and resolve mock/unknown ids to no rows.
    """

    @pytest.mark.parametrize(
        "resource,factory,path",
        [
            ("shot", ShotFactory, "/api/v1/shots/"),
            ("asset", AssetFactory, "/api/v1/assets/"),
            ("sequence", SequenceFactory, "/api/v1/sequences/"),
        ],
    )
    def test_project_id_filters_to_owning_project(
        self, staff_client, staff_user, resource, factory, path
    ):
        project_a = ProjectFactory.create(code="PAA")
        project_b = ProjectFactory.create(code="PBB")
        _member(staff_user, project_a)
        _member(staff_user, project_b)
        in_a = factory.create(project=project_a)
        factory.create(project=project_b)

        resp = staff_client.get(f"{path}?project_id={project_a.id}")
        assert resp.status_code == status.HTTP_200_OK, (path, resp.data)
        codes = [row["code"] for row in resp.data["results"]]
        assert codes == [in_a.code], path

    @pytest.mark.parametrize(
        "resource,factory,path",
        [
            ("shot", ShotFactory, "/api/v1/shots/"),
            ("asset", AssetFactory, "/api/v1/assets/"),
            ("sequence", SequenceFactory, "/api/v1/sequences/"),
        ],
    )
    def test_project_id_mock_and_unknown_resolve_to_empty(
        self, staff_client, staff_user, resource, factory, path
    ):
        project = ProjectFactory.create(code="NK99")
        _member(staff_user, project)
        factory.create(project=project)

        for url in (
            f"{path}?project_id=proj-999",
            f"{path}?project=proj-999",
        ):
            resp = staff_client.get(url)
            assert resp.status_code == status.HTTP_200_OK, (url, resp.data)
            assert resp.data["results"] == [], url
