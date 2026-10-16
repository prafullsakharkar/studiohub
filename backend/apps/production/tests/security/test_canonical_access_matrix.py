"""
Canonical access-matrix tests (ADR-0033, org-free revision).

Persona coverage for the layered authorization model:

    User → Authentication → Platform Role → Project/Show Membership →
    Permission → Scope → Resource → Action → ALLOW / DENY

Personas:

- Super Admin          — GLOBAL (is_superuser break-glass)
- Platform Admin       — GLOBAL (ADMIN-priority identity role)
- Production Admin     — permission grants + active ProjectMembership
- Regular User         — grants only, no production scope

plus privilege-escalation / isolation negatives:

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

from apps.identity.choices.rbac import RolePriority
from apps.identity.services.permission_cache import PermissionCacheService
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
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


def _project_member(user, project, *, show=None):
    return ProjectMembership.objects.create(
        user=user,
        project=project,
        show=show,
        role="Production Admin",
        scope="SHOW" if show is not None else "PROJECT",
        status="active",
    )


def _platform_admin(user):
    """Elevate ``user`` to platform admin (global ADMIN-priority role)."""
    role = grant_permissions(user, "project.view")
    role.priority = RolePriority.ADMIN
    role.save(update_fields=["priority"])
    PermissionCacheService.invalidate(user=user)
    return user


@pytest.fixture
def project_a(db):
    return ProjectFactory.create()


@pytest.fixture
def project_b(db):
    return ProjectFactory.create()


@pytest.fixture
def super_admin(db):
    return UserFactory.create(is_superuser=True)


@pytest.fixture
def platform_admin(db):
    return _platform_admin(UserFactory.create())


@pytest.fixture
def production_admin(project_a):
    """Permission grants but only PROJECT-scope visibility."""
    user = UserFactory.create()
    grant_permissions(
        user,
        "project.view",
        "shot.view",
        "shot.create",
        "shot.update",
        "show.view",
    )
    _project_member(user, project_a)
    return user


@pytest.fixture
def regular_user(db):
    """Permission grants with no project membership."""
    user = UserFactory.create()
    grant_permissions(user, "project.view", "shot.view")
    return user


@pytest.mark.django_db
class TestSuperAdminPersona:
    """Super Admin → GLOBAL (ADR-0033 D4: break-glass applies everywhere)."""

    def test_sees_all_projects(self, super_admin, project_a, project_b):
        client = _client_for(super_admin)
        response = client.get(reverse("api:v1:production:project-list"))
        assert response.status_code == status.HTTP_200_OK
        ids = {p["id"] for p in response.data["results"]}
        assert {str(project_a.id), str(project_b.id)} <= ids

    def test_can_act_without_memberships(self, super_admin, project_a):
        client = _client_for(super_admin)
        response = client.post(
            reverse("api:v1:production:shot-list"),
            data={"project": str(project_a.id), "code": "SH-SA1", "name": "Admin Shot"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
class TestPlatformAdminPersona:
    """Platform Admin → global ADMIN-priority role, project-wide."""

    def test_platform_wide_project_visibility(
        self, platform_admin, project_a, project_b
    ):
        client = _client_for(platform_admin)
        response = client.get(reverse("api:v1:production:project-list"))
        assert response.status_code == status.HTTP_200_OK
        ids = {p["id"] for p in response.data["results"]}
        assert ids == {str(project_a.id), str(project_b.id)}

    def test_non_member_sees_nothing_without_admin_role(
        self, project_a, project_b
    ):
        user = UserFactory.create()
        grant_permissions(user, "project.view")
        client = _client_for(user)
        response = client.get(reverse("api:v1:production:project-list"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []


@pytest.mark.django_db
class TestProductionAdminPersona:
    """Production Admin → grants + explicit project membership."""

    def test_sees_only_member_projects(self, production_admin, project_a, project_b):
        client = _client_for(production_admin)
        response = client.get(reverse("api:v1:production:project-list"))
        assert response.status_code == status.HTTP_200_OK
        ids = {p["id"] for p in response.data["results"]}
        assert ids == {str(project_a.id)}

    def test_cross_project_detail_denied(self, production_admin, project_a, project_b):
        client = _client_for(production_admin)
        response = client.get(
            reverse("api:v1:production:project-detail", args=[project_b.id]),
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_project_scoped_entity_listing_narrowed(
        self, production_admin, project_a, project_b
    ):
        ShotFactory.create(project=project_a, code="SHA-IN")
        ShotFactory.create(project=project_b, code="SHA-OUT")
        client = _client_for(production_admin)
        response = client.get(reverse("api:v1:production:shot-list"))
        assert response.status_code == status.HTTP_200_OK
        codes = {s["code"] for s in response.data["results"]}
        assert codes == {"SHA-IN"}

    def test_can_create_within_member_project(self, production_admin, project_a):
        client = _client_for(production_admin)
        response = client.post(
            reverse("api:v1:production:shot-list"),
            data={"project": str(project_a.id), "code": "SH-PA1", "name": "Scoped Shot"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_cannot_create_in_non_member_project(
        self, production_admin, project_b
    ):
        """Even with shot.create held, the target project is out of scope."""
        client = _client_for(production_admin)
        response = client.post(
            reverse("api:v1:production:shot-list"),
            data={"project": str(project_b.id), "code": "SH-PA9", "name": "Escalation"},
            format="json",
        )
        assert response.status_code in (
            status.HTTP_403_FORBIDDEN,
            status.HTTP_400_BAD_REQUEST,
        )
        from apps.production.models import Shot

        assert not Shot.objects.filter(code="SH-PA9").exists()

    def test_membership_revocation_revokes_access(
        self, production_admin, project_a
    ):
        client = _client_for(production_admin)
        ProjectMembership.objects.filter(
            user=production_admin, project=project_a
        ).delete()
        response = client.get(
            reverse("api:v1:production:project-detail", args=[project_a.id]),
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestRegularUserPersona:
    """Regular User → grants without membership see nothing; cannot create."""

    def test_no_project_membership_sees_nothing(self, regular_user, project_a):
        client = _client_for(regular_user)
        response = client.get(reverse("api:v1:production:project-list"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []

    def test_no_production_grant_cannot_create(self, project_a):
        user = UserFactory.create()
        ProjectMembership.objects.create(
            user=user, project=project_a, status="active"
        )
        client = _client_for(user)
        response = client.post(
            reverse("api:v1:production:shot-list"),
            data={"project": str(project_a.id), "code": "SH-RU1", "name": "No Grant"},
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestShowScopeIsolation:
    """ADR-0033 D2: SHOW is a first-class scope tier."""

    def test_show_scoped_membership_narrows_show_listing(self, project_a):
        show_in = ShowFactory.create(project=project_a, code="SHOW-IN")
        ShowFactory.create(project=project_a, code="SHOW-OUT")
        user = UserFactory.create()
        grant_permissions(user, "show.view")
        _project_member(user, project_a, show=show_in)

        client = _client_for(user)
        response = client.get(reverse("api:v1:production:show-list"))
        assert response.status_code == status.HTTP_200_OK
        codes = {s["code"] for s in response.data["results"]}
        assert codes == {"SHOW-IN"}

    def test_project_wide_membership_sees_all_shows(self, project_a):
        ShowFactory.create(project=project_a, code="S1")
        ShowFactory.create(project=project_a, code="S2")
        user = UserFactory.create()
        grant_permissions(user, "show.view")
        _project_member(user, project_a)

        client = _client_for(user)
        response = client.get(reverse("api:v1:production:show-list"))
        codes = {s["code"] for s in response.data["results"]}
        assert codes == {"S1", "S2"}

    def test_cross_project_show_denied(self, project_a, project_b):
        show_b = ShowFactory.create(project=project_b, code="S-B")
        user = UserFactory.create()
        grant_permissions(user, "show.view")
        _project_member(user, project_a)

        client = _client_for(user)
        response = client.get(
            reverse("api:v1:production:show-detail", args=[show_b.id]),
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestPrivilegedActionProtection:
    """Bulk / archive / restore / delete require their codes AND scope."""

    def test_bulk_create_requires_code(self, project_a):
        user = UserFactory.create()
        ProjectMembership.objects.create(
            user=user, project=project_a, status="active"
        )
        client = _client_for(user)
        response = client.post(
            "/api/v1/shots/bulk-create/",
            data=[
                {"project": str(project_a.id), "code": "SH-B1", "name": "Bulk 1"},
            ],
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_archive_requires_delete_grant(self, project_a):
        shot = ShotFactory.create(project=project_a)
        user = UserFactory.create()
        grant_permissions(user, "shot.view", "shot.update")
        ProjectMembership.objects.create(
            user=user, project=project_a, status="active"
        )
        client = _client_for(user)
        response = client.post(
            reverse("api:v1:production:shot-archive", args=[shot.id]),
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_restore_requires_scope(self, project_a, project_b):
        shot = ShotFactory.create(project=project_b)
        shot.delete()  # soft-delete
        user = UserFactory.create()
        grant_permissions(user, "shot.view", "shot.update", "shot.delete")
        # member ONLY of project_a; shot lives in project_b
        ProjectMembership.objects.create(
            user=user, project=project_a, status="active"
        )
        client = _client_for(user)
        response = client.post(
            reverse("api:v1:production:shot-restore", args=[shot.id]),
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
