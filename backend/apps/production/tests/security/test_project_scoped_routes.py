"""
Project-scoped nested routes and analytics (analysis findings F-M12, F-M13, WP A7).

``/api/organizations/projects/<project>/...`` needs the permission code of the
matching flat endpoint AND a project membership. The code is checked first and
does not depend on the project, so a caller without it learns nothing about
which projects exist; a caller with it gets 404 for an unknown project and for
a project they are not a member of.
"""

from __future__ import annotations

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory, ShotFactory, TaskFactory

pytestmark = pytest.mark.django_db

# sub-path -> permission code the route requires for GET
ROUTE_CODES = {
    "members": "project.view",
    "summary": "project.view",
    "dashboard": "project.view",
    "pipeline": "project.view",
    "notes": "project.view",
    "sequences": "sequence.view",
    "shots": "shot.view",
    "tasks": "task.view",
    "resources": "task.view",
    "assets": "asset.view",
    "versions": "version.view",
    "reviews": "review.view",
    "editorial": "track.view",
    "deliveries": "delivery.view",
    "files": "media.view",
    "activity": "audit.view",
    "schedule": "schedule.view",
}


def _url(project_ref, sub):
    return f"/api/organizations/projects/{project_ref}/{sub}"


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _member(user, project):
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")


@pytest.fixture
def project():
    return ProjectFactory.create(code="NEST01")


@pytest.fixture
def other_project():
    return ProjectFactory.create(code="NEST02")


@pytest.fixture
def reader(project):
    """Member of ``project`` holding every GET code of the nested routes."""
    user = UserFactory.create()
    grant_permissions(user, *set(ROUTE_CODES.values()))
    _member(user, project)
    return user


class TestMembership:
    @pytest.mark.parametrize("sub", sorted(ROUTE_CODES))
    def test_member_reads_every_route(self, reader, project, sub):
        resp = _client(reader).get(_url(project.id, sub))

        assert resp.status_code == status.HTTP_200_OK, (sub, resp.data)

    @pytest.mark.parametrize("sub", sorted(ROUTE_CODES))
    def test_non_member_gets_404_not_403(self, reader, other_project, sub):
        resp = _client(reader).get(_url(other_project.id, sub))

        assert resp.status_code == status.HTTP_404_NOT_FOUND, sub

    def test_non_member_looks_like_unknown_project(self, reader, other_project):
        client = _client(reader)

        foreign = client.get(_url(other_project.code, "summary"))
        unknown = client.get(_url("DOES-NOT-EXIST", "summary"))

        assert foreign.status_code == unknown.status_code == status.HTTP_404_NOT_FOUND

    def test_suspended_member_gets_404(self, reader, project):
        ProjectMembership.objects.filter(user=reader, project=project).update(status="suspended")

        assert (
            _client(reader).get(_url(project.id, "summary")).status_code
            == status.HTTP_404_NOT_FOUND
        )


class TestPermissionCodes:
    @pytest.mark.parametrize(("sub", "code"), sorted(ROUTE_CODES.items()))
    def test_member_without_the_code_gets_403(self, project, sub, code):
        user = UserFactory.create()
        grant_permissions(user, *(c for c in set(ROUTE_CODES.values()) if c != code))
        _member(user, project)

        assert _client(user).get(_url(project.id, sub)).status_code == status.HTTP_403_FORBIDDEN, (
            sub
        )

    def test_missing_code_answers_the_same_for_every_project(self, project, other_project):
        user = UserFactory.create()
        _member(user, project)
        client = _client(user)

        answers = {
            client.get(_url(ref, "shots")).status_code
            for ref in (project.id, other_project.id, "DOES-NOT-EXIST")
        }

        assert answers == {status.HTTP_403_FORBIDDEN}

    def test_anonymous_is_401(self, project):
        assert (
            APIClient().get(_url(project.id, "summary")).status_code == status.HTTP_401_UNAUTHORIZED
        )

    def test_notes_post_needs_note_create(self, reader, project):
        client = _client(reader)
        body = {"subject": "Hi", "body": "Note"}

        assert client.post(_url(project.id, "notes"), body, format="json").status_code == 403

        grant_permissions(reader, "note.create")
        created = client.post(_url(project.id, "notes"), body, format="json")

        assert created.status_code == status.HTTP_201_CREATED, created.data

    def test_notes_post_in_foreign_project_is_404_even_with_the_code(self, reader, other_project):
        grant_permissions(reader, "note.create")

        resp = _client(reader).post(
            _url(other_project.id, "notes"), {"subject": "x", "body": "y"}, format="json"
        )

        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_adding_members_needs_a_platform_admin_even_with_the_code(self, reader, project):
        grant_permissions(reader, "project.update")
        target = UserFactory.create()

        resp = _client(reader).post(
            _url(project.id, "members"),
            {"user_id": str(target.id), "role": "Artist"},
            format="json",
        )

        assert resp.status_code == status.HTTP_403_FORBIDDEN
        assert not ProjectMembership.objects.filter(user=target).exists()


class TestAnalyticsScope:
    def test_kpis_count_only_member_projects(self, project, other_project):
        user = UserFactory.create()
        _member(user, project)
        ShotFactory.create(project=project, code="IN1", status="Approved")
        ShotFactory.create(project=other_project, code="OUT1", status="Approved")
        ShotFactory.create(project=other_project, code="OUT2", status="Approved")

        resp = _client(user).get("/api/v1/analytics/kpis/")

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["total_active_projects"] == 1
        assert resp.data["total_shots"] == 1
        assert resp.data["approved_shots"] == 1

    def test_kpis_of_a_user_without_memberships_are_empty(self, project):
        ShotFactory.create(project=project, code="OUT1")

        resp = _client(UserFactory.create()).get("/api/v1/analytics/kpis/")

        assert resp.data["total_active_projects"] == 0
        assert resp.data["total_shots"] == 0

    def test_superuser_counts_every_project(self, project, other_project):
        ShotFactory.create(project=project, code="S1")
        ShotFactory.create(project=other_project, code="S2")

        resp = _client(UserFactory.create(is_superuser=True)).get("/api/v1/analytics/kpis/")

        assert resp.data["total_active_projects"] == 2
        assert resp.data["total_shots"] == 2

    def test_departments_count_only_member_projects(self, project, other_project):
        user = UserFactory.create()
        _member(user, project)
        TaskFactory.create(project=project, code="TIN", department="Comp")
        TaskFactory.create(project=other_project, code="TOUT", department="FX")

        resp = _client(user).get("/api/v1/analytics/departments/")

        assert resp.status_code == status.HTTP_200_OK
        assert [row["department"] for row in resp.data] == ["Comp"]
