"""
Canonical access-matrix tests (ADR-0033).

Persona coverage for the layered authorization model:

    User → Authentication → Platform Role → Organization Membership →
    Organization Role → Project/Show Membership → Permission → Scope →
    Resource → Action → ALLOW / DENY

Personas:

- Super Admin          — GLOBAL (is_superuser break-glass)
- Organization Admin   — active org membership, ADMIN-priority role
- Production Admin     — active org membership (non-ADMIN) + active ProjectMembership
- Regular User         — org membership only, no production scope

plus privilege-escalation / isolation negatives:

- cross-organization access
- cross-project access
- cross-show access
- unauthorized CRUD / bulk / archive / restore / delete
- membership removal revokes access
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.choices.role_priority import RolePriority
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
)
from apps.organization.tests.rbac_helpers import (
    grant_org_admin,
    grant_permissions,
)
from apps.production.models.project_membership import ProjectMembership
from apps.production.tests.factories import (
    ProjectFactory,
    ShotFactory,
    ShowFactory,
)


def _client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _org_headers(organization):
    return {"HTTP_X_ORGANIZATION_ID": str(organization.pk)}


def _project_member(user, organization, project, *, show=None):
    return ProjectMembership.objects.create(
        user=user,
        organization=organization,
        project=project,
        show=show,
        role="Production Admin",
        scope="SHOW" if show is not None else "PROJECT",
        status="Active",
    )


@pytest.fixture
def org_a(db):
    return OrganizationFactory.create()


@pytest.fixture
def org_b(db):
    return OrganizationFactory.create()


@pytest.fixture
def project_a(org_a):
    return ProjectFactory.create(organization=org_a)


@pytest.fixture
def project_b(org_a):
    return ProjectFactory.create(organization=org_a)


@pytest.fixture
def super_admin(db):
    return UserFactory.create(is_superuser=True)


@pytest.fixture
def org_admin(org_a):
    user = UserFactory.create()
    grant_org_admin(user, org_a)
    return user


@pytest.fixture
def production_admin(org_a, project_a):
    """Org member with production codes but only PROJECT-scope visibility."""
    user = UserFactory.create()
    grant_permissions(
        user,
        "project.view",
        "shot.view",
        "shot.create",
        "shot.update",
        "show.view",
        organization=org_a,
    )
    _project_member(user, org_a, project_a)
    return user


@pytest.fixture
def regular_user(org_a):
    """Active org member with directory-level grants only."""
    user = UserFactory.create()
    grant_permissions(user, "project.view", "shot.view", organization=org_a)
    return user


@pytest.mark.django_db
class TestSuperAdminPersona:
    """Super Admin → GLOBAL (ADR-0033 D4: break-glass applies everywhere)."""

    def test_sees_all_projects_across_organizations(
        self, super_admin, org_a, org_b, project_a
    ):
        ProjectFactory.create(organization=org_b)
        client = _client_for(super_admin)
        response = client.get(
            reverse("api:v1:production:project-list"),
            HTTP_X_ORGANIZATION_ID=str(org_a.pk),
        )
        assert response.status_code == status.HTTP_200_OK
        assert str(project_a.id) in [p["id"] for p in response.data["results"]]

    def test_can_act_without_memberships(self, super_admin, org_a, project_a):
        client = _client_for(super_admin)
        response = client.post(
            reverse("api:v1:production:shot-list"),
            data={"project": str(project_a.id), "code": "SH-SA1", "name": "Admin Shot"},
            format="json",
            **_org_headers(org_a),
        )
        assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
class TestOrganizationAdminPersona:
    """Organization Admin → explicit organization membership, org-wide."""

    def test_org_wide_project_visibility(self, org_admin, org_a, project_a, project_b):
        client = _client_for(org_admin)
        response = client.get(
            reverse("api:v1:production:project-list"), **_org_headers(org_a)
        )
        assert response.status_code == status.HTTP_200_OK
        ids = {p["id"] for p in response.data["results"]}
        assert ids == {str(project_a.id), str(project_b.id)}

    def test_cross_organization_isolation(self, org_admin, org_a, org_b):
        ProjectFactory.create(organization=org_b)
        client = _client_for(org_admin)
        response = client.get(
            reverse("api:v1:production:project-list"),
            HTTP_X_ORGANIZATION_ID=str(org_b.pk),
        )
        # The header names an org the user is not a member of: fail closed.
        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_200_OK)
        if response.status_code == status.HTTP_200_OK:
            assert response.data["results"] == []


@pytest.mark.django_db
class TestProductionAdminPersona:
    """Production Admin → explicit org + production (project/show) scope."""

    def test_sees_only_member_projects(self, production_admin, org_a, project_a, project_b):
        client = _client_for(production_admin)
        response = client.get(
            reverse("api:v1:production:project-list"), **_org_headers(org_a)
        )
        assert response.status_code == status.HTTP_200_OK
        ids = {p["id"] for p in response.data["results"]}
        assert ids == {str(project_a.id)}

    def test_cross_project_detail_denied(self, production_admin, org_a, project_a, project_b):
        client = _client_for(production_admin)
        response = client.get(
            reverse("api:v1:production:project-detail", args=[project_b.id]),
            **_org_headers(org_a),
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_project_scoped_entity_listing_narrowed(
        self, production_admin, org_a, project_a, project_b
    ):
        ShotFactory.create(organization=org_a, project=project_a, code="SHA-IN")
        ShotFactory.create(organization=org_a, project=project_b, code="SHA-OUT")
        client = _client_for(production_admin)
        response = client.get(
            reverse("api:v1:production:shot-list"), **_org_headers(org_a)
        )
        assert response.status_code == status.HTTP_200_OK
        codes = {s["code"] for s in response.data["results"]}
        assert codes == {"SHA-IN"}

    def test_can_create_within_member_project(self, production_admin, org_a, project_a):
        client = _client_for(production_admin)
        response = client.post(
            reverse("api:v1:production:shot-list"),
            data={"project": str(project_a.id), "code": "SH-PA1", "name": "Scoped Shot"},
            format="json",
            **_org_headers(org_a),
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_cannot_create_in_non_member_project(
        self, production_admin, org_a, project_b
    ):
        """Even with shot.create held org-wide, the target project is out of scope."""
        client = _client_for(production_admin)
        response = client.post(
            reverse("api:v1:production:shot-list"),
            data={"project": str(project_b.id), "code": "SH-PA9", "name": "Escalation"},
            format="json",
            **_org_headers(org_a),
        )
        assert response.status_code in (
            status.HTTP_403_FORBIDDEN,
            status.HTTP_400_BAD_REQUEST,
        )
        from apps.production.models import Shot

        assert not Shot.objects.filter(code="SH-PA9").exists()

    def test_membership_revocation_revokes_access(
        self, production_admin, org_a, project_a
    ):
        client = _client_for(production_admin)
        ProjectMembership.objects.filter(
            user=production_admin, project=project_a
        ).delete()
        response = client.get(
            reverse("api:v1:production:project-detail", args=[project_a.id]),
            **_org_headers(org_a),
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestRegularUserPersona:
    """Regular User → explicit permissions/resources only."""

    def test_no_project_membership_sees_nothing(self, regular_user, org_a, project_a):
        client = _client_for(regular_user)
        response = client.get(
            reverse("api:v1:production:project-list"), **_org_headers(org_a)
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []

    def test_no_production_grant_cannot_create(self, org_a, project_a):
        user = UserFactory.create()
        OrganizationMembershipFactory.create(user=user, organization=org_a, status="active")
        ProjectMembership.objects.create(
            user=user, organization=org_a, project=project_a, status="Active"
        )
        client = _client_for(user)
        response = client.post(
            reverse("api:v1:production:shot-list"),
            data={"project": str(project_a.id), "code": "SH-RU1", "name": "No Grant"},
            format="json",
            **_org_headers(org_a),
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestShowScopeIsolation:
    """ADR-0033 D2: SHOW is a first-class scope tier."""

    def test_show_scoped_membership_narrows_show_listing(self, org_a, project_a):
        show_in = ShowFactory.create(organization=org_a, project=project_a, code="SHOW-IN")
        ShowFactory.create(organization=org_a, project=project_a, code="SHOW-OUT")
        user = UserFactory.create()
        grant_permissions(user, "show.view", organization=org_a)
        _project_member(user, org_a, project_a, show=show_in)

        client = _client_for(user)
        response = client.get(
            reverse("api:v1:production:show-list"), **_org_headers(org_a)
        )
        assert response.status_code == status.HTTP_200_OK
        codes = {s["code"] for s in response.data["results"]}
        assert codes == {"SHOW-IN"}

    def test_project_wide_membership_sees_all_shows(self, org_a, project_a):
        ShowFactory.create(organization=org_a, project=project_a, code="S1")
        ShowFactory.create(organization=org_a, project=project_a, code="S2")
        user = UserFactory.create()
        grant_permissions(user, "show.view", organization=org_a)
        _project_member(user, org_a, project_a)

        client = _client_for(user)
        response = client.get(
            reverse("api:v1:production:show-list"), **_org_headers(org_a)
        )
        codes = {s["code"] for s in response.data["results"]}
        assert codes == {"S1", "S2"}

    def test_cross_project_show_denied(self, org_a, project_a, project_b):
        show_b = ShowFactory.create(organization=org_a, project=project_b, code="S-B")
        user = UserFactory.create()
        grant_permissions(user, "show.view", organization=org_a)
        _project_member(user, org_a, project_a)

        client = _client_for(user)
        response = client.get(
            reverse("api:v1:production:show-detail", args=[show_b.id]),
            **_org_headers(org_a),
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestPrivilegedActionProtection:
    """Bulk / archive / restore / delete require their codes AND scope."""

    def test_bulk_create_requires_code(self, org_a, project_a):
        user = UserFactory.create()
        OrganizationMembershipFactory.create(user=user, organization=org_a, status="active")
        ProjectMembership.objects.create(
            user=user, organization=org_a, project=project_a, status="Active"
        )
        client = _client_for(user)
        response = client.post(
            "/api/v1/shots/bulk-create/",
            data=[
                {"project": str(project_a.id), "code": "SH-B1", "name": "Bulk 1"},
            ],
            format="json",
            **_org_headers(org_a),
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_archive_requires_delete_grant(self, org_a, project_a):
        shot = ShotFactory.create(organization=org_a, project=project_a)
        user = UserFactory.create()
        grant_permissions(user, "shot.view", "shot.update", organization=org_a)
        ProjectMembership.objects.create(
            user=user, organization=org_a, project=project_a, status="Active"
        )
        client = _client_for(user)
        response = client.post(
            reverse("api:v1:production:shot-archive", args=[shot.id]),
            **_org_headers(org_a),
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_restore_requires_scope(self, org_a, project_a, project_b):
        shot = ShotFactory.create(organization=org_a, project=project_b)
        shot.delete()  # soft-delete
        user = UserFactory.create()
        grant_permissions(user, "shot.view", "shot.update", "shot.delete", organization=org_a)
        # member ONLY of project_a; shot lives in project_b
        ProjectMembership.objects.create(
            user=user, organization=org_a, project=project_a, status="Active"
        )
        client = _client_for(user)
        response = client.post(
            reverse("api:v1:production:shot-restore", args=[shot.id]),
            **_org_headers(org_a),
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
