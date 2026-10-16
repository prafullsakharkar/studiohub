"""
Project-scope isolation tests (org-free).

Projects are top-level containers: creation requires no organization, and
every production queryset is narrowed to the caller's active
``ProjectMembership`` set (fail closed). There is no organization header,
no organization FK, and no cross-project leakage.
"""

import pytest
from django.urls import reverse
from rest_framework import status

from apps.identity.models import Role
from apps.production.models import Project, ProjectMembership, Shot
from apps.production.tests.factories import ProjectFactory, ShotFactory


def _member(user, project, **kwargs):
    kwargs.setdefault("status", "active")
    kwargs.setdefault("role", "Artist")
    return ProjectMembership.objects.create(user=user, project=project, **kwargs)


def _members_url(project):
    return f"/api/organizations/projects/{project.id}/members/"


@pytest.mark.django_db
class TestProjectScope:
    def test_create_requires_no_org_header(self, staff_client):
        resp = staff_client.post(
            reverse("api:v1:production:project-list"),
            data={"code": "PSCO01", "name": "Scope Project"},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        project = Project.objects.get(code="PSCO01")
        assert not hasattr(project, "organization")

    def test_list_scoped_to_membership(self, staff_client, staff_user):
        in_project = ProjectFactory.create(code="PSCIN01")
        ProjectFactory.create(code="PSCOUT01")
        _member(staff_user, in_project)

        resp = staff_client.get(reverse("api:v1:production:project-list"))
        assert resp.status_code == status.HTTP_200_OK
        codes = {p["code"] for p in resp.data["results"]}
        assert "PSCIN01" in codes
        assert "PSCOUT01" not in codes

    def test_detail_denied_without_membership(self, staff_client):
        project = ProjectFactory.create(code="PSCDET01")
        resp = staff_client.get(
            reverse("api:v1:production:project-detail", args=[project.id])
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_no_membership_sees_nothing(self, staff_client):
        ProjectFactory.create(code="PSCEMPTY01")
        resp = staff_client.get(reverse("api:v1:production:project-list"))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["results"] == []

    def test_create_entity_in_non_member_project_fails_closed(
        self, staff_client, staff_user
    ):
        project = ProjectFactory.create(code="PSCNM01")
        resp = staff_client.post(
            reverse("api:v1:production:shot-list"),
            data={"project": str(project.id), "code": "SH-NM1", "name": "No Scope"},
            format="json",
        )
        assert resp.status_code in (
            status.HTTP_403_FORBIDDEN,
            status.HTTP_400_BAD_REQUEST,
        )
        assert not Shot.objects.filter(code="SH-NM1").exists()

    def test_membership_revocation_revokes_access(self, staff_client, staff_user):
        project = ProjectFactory.create(code="PSCREV01")
        membership = _member(staff_user, project)
        resp = staff_client.get(
            reverse("api:v1:production:project-detail", args=[project.id])
        )
        assert resp.status_code == status.HTTP_200_OK
        membership.delete()
        resp = staff_client.get(
            reverse("api:v1:production:project-detail", args=[project.id])
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_entity_listing_narrowed_to_member_projects(
        self, staff_client, staff_user
    ):
        in_project = ProjectFactory.create(code="PSCEN1")
        out_project = ProjectFactory.create(code="PSCEN2")
        _member(staff_user, in_project)
        ShotFactory.create(project=in_project, code="SH-EN-IN")
        ShotFactory.create(project=out_project, code="SH-EN-OUT")

        resp = staff_client.get(reverse("api:v1:production:shot-list"))
        assert resp.status_code == status.HTTP_200_OK
        codes = {s["code"] for s in resp.data["results"]}
        assert codes == {"SH-EN-IN"}


@pytest.mark.django_db
class TestProjectMembersEndpoint:
    def test_add_member_links_identity_role_id(self, admin_client):
        from django.contrib.auth import get_user_model

        project = ProjectFactory.create(code="PSCMEM01")
        role = Role.objects.create(code="pscmem-artist", name="PSCmem Artist")
        target = get_user_model().objects.create_user(
            email="mem@psc.io", password="x"
        )
        resp = admin_client.post(
            _members_url(project),
            {"user_id": str(target.id), "role": "Artist", "role_id": str(role.id)},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        assert resp.data["role_id"] == str(role.id)

    def test_add_member_rejects_unknown_role_id(self, admin_client):
        import uuid

        from django.contrib.auth import get_user_model

        project = ProjectFactory.create(code="PSCMEM02")
        target = get_user_model().objects.create_user(
            email="mem2@psc.io", password="x"
        )
        resp = admin_client.post(
            _members_url(project),
            {
                "user_id": str(target.id),
                "role": "Artist",
                "role_id": str(uuid.uuid4()),
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "role_id" in resp.data

    def test_add_member_honors_requested_status(self, admin_client):
        from django.contrib.auth import get_user_model

        project = ProjectFactory.create(code="PSCMEM03")
        target = get_user_model().objects.create_user(
            email="mem3@psc.io", password="x"
        )
        resp = admin_client.post(
            _members_url(project),
            {"user_id": str(target.id), "role": "Artist", "status": "Suspended"},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        assert resp.data["status"] == "suspended"

    def test_non_admin_cannot_add_members(self, staff_user):
        from rest_framework.test import APIClient

        from apps.identity.tests.factories import UserFactory

        project = ProjectFactory.create(code="PSCMEM04")
        target = UserFactory.create()
        client = APIClient()
        client.force_authenticate(user=staff_user)
        resp = client.post(
            _members_url(project),
            {"user_id": str(target.id), "role": "Artist"},
            format="json",
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN
