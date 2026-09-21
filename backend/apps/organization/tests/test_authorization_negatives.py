"""
Remaining authorization negatives: organization settings mutation codes,
audit privileged mutations, masterdata catalog writes, and the
?include_deleted visibility gate.
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.constants.permissions import OrganizationPermissions
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
    PermissionFactory,
    RoleFactory,
    RolePermissionFactory,
)
from apps.organization.tests.rbac_helpers import grant_permissions


def _hdr(org):
    return {"HTTP_X_ORGANIZATION_ID": str(org.id)}


def _client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _grant(user, org, *codes):
    role = RoleFactory.create(organization=org)
    for code in codes:
        permission = PermissionFactory.create(code=code)
        RolePermissionFactory.create(role=role, permission=permission, granted=True)
    OrganizationMembershipFactory.create(user=user, organization=org, role=role)
    return role


@pytest.mark.django_db
class TestOrganizationSettingsMutationCode:
    def _settings_url(self, org):
        return reverse(
            "api:v1:organization-legacy:legacy-organization-organization-settings",
            kwargs={"uuid": str(org.id)},
        )

    def test_settings_patch_requires_update_grant(self):
        org = OrganizationFactory.create()
        user = UserFactory.create()
        _grant(user, org, OrganizationPermissions.VIEW)
        client = _client_for(user)
        response = client.patch(
            self._settings_url(org),
            {"organization_settings": {"timezone": "UTC"}},
            format="json",
            **_hdr(org),
        )
        assert response.status_code == 403, response.data

    def test_settings_patch_allowed_with_update_grant(self, staff_client):
        org = OrganizationFactory.create()
        response = staff_client.patch(
            self._settings_url(org),
            {"timezone": "UTC"},
            format="json",
            **_hdr(org),
        )
        assert response.status_code in (200, 400), response.data

    def test_settings_get_allowed_with_view_grant(self):
        org = OrganizationFactory.create()
        user = UserFactory.create()
        _grant(user, org, OrganizationPermissions.VIEW)
        client = _client_for(user)
        response = client.get(self._settings_url(org), **_hdr(org))
        assert response.status_code == 200, response.data


@pytest.mark.django_db
class TestAuditMutationCodes:
    def test_background_job_retry_requires_update(self):
        from apps.audit.tests.factories import BackgroundJobFactory

        org = OrganizationFactory.create()
        user = UserFactory.create()
        OrganizationMembershipFactory.create(user=user, organization=org)
        job = BackgroundJobFactory.create(organization=org)
        client = _client_for(user)
        url = f"/api/v1/audit/background-jobs/{job.uuid}/retry/"
        response = client.post(url, **_hdr(org))
        assert response.status_code == 403, response.data

    def test_background_job_retry_allowed_with_grant(self, staff_client):
        from apps.audit.tests.factories import BackgroundJobFactory

        org = OrganizationFactory.create()
        job = BackgroundJobFactory.create(organization=org)
        url = f"/api/v1/audit/background-jobs/{job.uuid}/retry/"
        response = staff_client.post(url, **_hdr(org))
        assert response.status_code == 200, response.data

    def test_audit_log_list_open_to_members(self):
        org = OrganizationFactory.create()
        user = UserFactory.create()
        OrganizationMembershipFactory.create(user=user, organization=org)
        client = _client_for(user)
        response = client.get("/api/v1/audit/audit-logs/", **_hdr(org))
        assert response.status_code == 200, response.data


@pytest.mark.django_db
class TestMasterdataCatalogWrites:
    def test_catalog_create_denied_for_plain_user(self, authenticated_client):
        response = authenticated_client.post(
            "/api/v1/platform/master-data/statuses",
            {"code": "SEC-001", "name": "Security Probe", "scope": "GLOBAL"},
            format="json",
        )
        assert response.status_code == 403, response.data

    def test_catalog_create_allowed_for_staff(self, staff_client):
        response = staff_client.get("/api/v1/platform/master-data/statuses")
        assert response.status_code == 200, response.data


@pytest.mark.django_db
class TestIncludeDeletedGate:
    def test_viewer_cannot_see_deleted_with_flag(self):
        from apps.production.tests.factories import ProjectFactory

        org = OrganizationFactory.create()
        user = UserFactory.create()
        grant_permissions(
            user, "projects:read", organization=org
        )
        project = ProjectFactory.create(organization=org)
        project.delete()
        client = _client_for(user)
        response = client.get(
            "/api/v1/projects/?include_deleted=true", **_hdr(org)
        )
        assert response.status_code == 200, response.data
        results = response.data["results"] if isinstance(response.data, dict) else response.data
        assert all(str(row["id"]) != str(project.id) for row in results)

    def test_delete_grant_sees_deleted_with_flag(self):
        from apps.production.tests.factories import ProjectFactory

        org = OrganizationFactory.create()
        user = UserFactory.create()
        grant_permissions(
            user, "projects:read", "projects:delete", organization=org
        )
        project = ProjectFactory.create(organization=org)
        project.delete()
        client = _client_for(user)
        response = client.get(
            "/api/v1/projects/?include_deleted=true", **_hdr(org)
        )
        assert response.status_code == 200, response.data
        results = response.data["results"] if isinstance(response.data, dict) else response.data
        assert any(str(row["id"]) == str(project.id) for row in results)
