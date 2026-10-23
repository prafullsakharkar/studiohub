"""
API tests for the platform master-data catalog endpoints.

Organization-scoped effective master-data tests were deleted with the org
removal plan (those routes 404 by absence).
"""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.masterdata.models import MasterDataScope, Software

pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return UserFactory.create()


@pytest.fixture
def auth_client(user):
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def staff_user(db):
    return UserFactory.create(is_staff=True)


@pytest.fixture
def staff_client(staff_user):
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=staff_user)
    return client


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


def test_platform_software_archive_and_restore(staff_user, staff_client):
    grant_permissions(staff_user, "platform.master_data.configure")
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


def test_platform_software_delete_is_a_soft_delete_with_the_success_message(
    staff_user, staff_client
):
    """DELETE soft-deletes (approved 2026-10-23); it no longer archives the row."""
    grant_permissions(staff_user, "platform.master_data.configure")
    software = Software.objects.create(
        name="Maya",
        code="MAYA",
        scope=MasterDataScope.GLOBAL,
    )

    resp = staff_client.delete(f"/api/v1/platform/master-data/software/{software.id}")

    assert resp.status_code == 200
    assert resp.json() == {"success": True, "message": "Software deleted."}
    row = Software.all_objects.get(pk=software.pk)
    assert row.is_deleted is True and row.status == "active"


def test_platform_overview(auth_client):
    Software.objects.create(name="Maya", code="MAYA", scope=MasterDataScope.GLOBAL)

    resp = auth_client.get("/api/v1/platform/overview")

    assert resp.status_code == 200
    data = resp.json()
    assert data["global_software_count"] == 1
    assert data["system_health"] == "healthy"
    assert data["last_definition_update"] is None


def test_org_master_data_routes_404_by_absence(auth_client, user):
    """The org-scoped master-data trees are gone after the org removal."""
    resp = auth_client.get(
        "/api/v1/organizations/00000000-0000-0000-0000-000000000000/master-data/bundle"
    )
    assert resp.status_code == 404
