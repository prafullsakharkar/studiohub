"""
API tests for the platform master-data re-scope and organization-scoped
effective master-data endpoints.
"""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import UserFactory
from apps.masterdata.models import (
    MasterDataScope,
    OrganizationSoftwareConfig,
    Software,
)
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
    PermissionFactory,
    RoleFactory,
    RolePermissionFactory,
    UserRoleFactory,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return UserFactory.create()


@pytest.fixture
def other_user(db):
    return UserFactory.create()


@pytest.fixture
def staff_user(db):
    return UserFactory.create(is_staff=True)


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def auth_client(user):
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def other_client(other_user):
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=other_user)
    return client


@pytest.fixture
def staff_client(staff_user):
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=staff_user)
    return client


@pytest.fixture
def organization(db):
    return OrganizationFactory.create()


@pytest.fixture
def membership(user, organization):
    return OrganizationMembershipFactory.create(
        user=user,
        organization=organization,
        status="active",
    )


def grant_permission(user, organization, code):
    permission = PermissionFactory.create(code=code)
    role = RoleFactory.create(organization=organization)
    RolePermissionFactory.create(role=role, permission=permission)
    UserRoleFactory.create(user=user, role=role)


def test_platform_software_list_returns_global_scope_only(auth_client):
    Software.objects.create(name="Maya", code="MAYA", scope=MasterDataScope.GLOBAL)
    Software.objects.create(name="Nuke", code="NUKE", scope=MasterDataScope.GLOBAL)
    Software.objects.create(
        name="Org Custom",
        code="ORGX",
        scope=MasterDataScope.ORGANIZATION,
    )

    resp = auth_client.get("/api/v1/platform/master-data/software")

    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert {s["code"] for s in resp.json()} == {"MAYA", "NUKE"}


def test_platform_software_list_includes_archived(auth_client):
    Software.objects.create(
        name="Maya",
        code="MAYA",
        scope=MasterDataScope.GLOBAL,
        status="archived",
    )

    resp = auth_client.get("/api/v1/platform/master-data/software")

    assert resp.status_code == 200
    assert {s["code"] for s in resp.json()} == {"MAYA"}


def test_platform_software_archive_and_restore(staff_client):
    software = Software.objects.create(
        name="Maya",
        code="MAYA",
        scope=MasterDataScope.GLOBAL,
    )

    archive = staff_client.post(f"/api/v1/platform/master-data/software/{software.id}/archive")
    assert archive.status_code == 200
    assert archive.json()["success"] is True
    assert archive.json()["data"]["status"] == "archived"

    software.refresh_from_db()
    assert software.status == "archived"

    restore = staff_client.post(f"/api/v1/platform/master-data/software/{software.id}/restore")
    assert restore.status_code == 200
    assert restore.json()["data"]["status"] == "active"


def test_platform_software_delete_returns_success_message(staff_client):
    software = Software.objects.create(
        name="Maya",
        code="MAYA",
        scope=MasterDataScope.GLOBAL,
    )

    resp = staff_client.delete(f"/api/v1/platform/master-data/software/{software.id}")

    assert resp.status_code == 200
    assert resp.json() == {"success": True, "message": "Software archived."}
    software.refresh_from_db()
    assert software.status == "archived"


def test_platform_overview(auth_client):
    Software.objects.create(name="Maya", code="MAYA", scope=MasterDataScope.GLOBAL)

    resp = auth_client.get("/api/v1/platform/overview")

    assert resp.status_code == 200
    data = resp.json()
    assert data["global_software_count"] == 1
    assert data["system_health"] == "healthy"
    assert data["last_definition_update"] is None


def test_org_bundle_requires_membership(auth_client, other_client, organization, membership):
    resp = auth_client.get(f"/api/v1/organizations/{organization.id}/master-data/bundle")
    assert resp.status_code == 200
    assert "software" in resp.json()

    forbidden = other_client.get(f"/api/v1/organizations/{organization.id}/master-data/bundle")
    assert forbidden.status_code == 403
    assert forbidden.json()["detail"] == "Access to this organization denied."


def test_org_type_list_requires_membership_except_file_types(
    auth_client,
    other_client,
    organization,
    membership,
):
    resp = auth_client.get(f"/api/v1/organizations/{organization.id}/master-data/software")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

    forbidden = other_client.get(f"/api/v1/organizations/{organization.id}/master-data/software")
    assert forbidden.status_code == 403

    file_types = other_client.get(f"/api/v1/organizations/{organization.id}/master-data/file-types")
    assert file_types.status_code == 200


def test_org_config_put_requires_configure_permission(
    auth_client,
    user,
    other_client,
    organization,
    membership,
):
    software = Software.objects.create(
        name="Maya",
        code="MAYA",
        scope=MasterDataScope.GLOBAL,
    )
    grant_permission(user=user, organization=organization, code="organization.master_data.configure")

    url = f"/api/v1/organizations/{organization.id}/master-data/software/{software.id}/config"
    payload = {"enabled": False, "display_name_override": "Maya LT"}

    resp = auth_client.put(url, payload, format="json")

    assert resp.status_code == 200
    assert resp.json()["display_name_override"] == "Maya LT"
    assert OrganizationSoftwareConfig.objects.filter(organization=organization, software=software).exists()

    forbidden = other_client.put(url, payload, format="json")
    assert forbidden.status_code == 403


def test_org_config_put_maps_executable_path_overrides(
    auth_client,
    user,
    organization,
    membership,
):
    software = Software.objects.create(
        name="Maya",
        code="MAYA",
        scope=MasterDataScope.GLOBAL,
    )
    grant_permission(user=user, organization=organization, code="organization.master_data.configure")

    url = f"/api/v1/organizations/{organization.id}/master-data/software/{software.id}/config"
    resp = auth_client.put(
        url,
        {"enabled": True, "executable_path_overrides": {"linux": "/opt/maya"}},
        format="json",
    )

    assert resp.status_code == 200
    config = OrganizationSoftwareConfig.objects.get(organization=organization, software=software)
    assert config.executable_paths == {"linux": "/opt/maya"}


def test_org_custom_create_requires_create_permission(
    auth_client,
    user,
    other_client,
    organization,
    membership,
):
    grant_permission(user=user, organization=organization, code="organization.master_data.create")

    url = f"/api/v1/organizations/{organization.id}/master-data/software/custom"
    payload = {"name": "Custom Tool", "code": "CUSTOM1"}

    resp = auth_client.post(url, payload, format="json")

    assert resp.status_code == 201
    created = Software.objects.get(code="CUSTOM1")
    assert created.scope == MasterDataScope.ORGANIZATION
    assert created.organization_id == organization.id

    forbidden = other_client.post(url, payload, format="json")
    assert forbidden.status_code == 403


def test_org_custom_create_unknown_type_404(auth_client, user, organization, membership):
    grant_permission(user=user, organization=organization, code="organization.master_data.create")

    resp = auth_client.post(
        f"/api/v1/organizations/{organization.id}/master-data/unknown/custom",
        {"name": "X", "code": "X1"},
        format="json",
    )
    assert resp.status_code == 404
