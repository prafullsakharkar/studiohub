"""
API tests for OrganizationViewSet custom actions.

Covers the contract of `my`, `archive`, `restore`, `export`, `switch`, and
`settings` — endpoints with no prior API-level coverage (service-level
archive/restore are tested in `test_organization_services.py`).
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.models import Organization
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
    PermissionFactory,
    RoleFactory,
    RolePermissionFactory,
)


def _member_client(org, *perm_codes):
    """Authenticated member of `org` holding the given permission codes."""
    user = UserFactory.create()
    role = RoleFactory.create(organization=org)
    for code in perm_codes:
        permission = PermissionFactory.create(code=code)
        RolePermissionFactory.create(role=role, permission=permission)
    OrganizationMembershipFactory.create(user=user, organization=org, role=role)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _org_header(org):
    return {"HTTP_X_ORGANIZATION_ID": str(org.id)}


def _action_url(org, name):
    # DRF names extra actions `{basename}-{url_path}`; `settings` lives on the
    # `organization_settings` method, hence the doubled prefix.
    action = "organization-settings" if name == "settings" else name
    return reverse(
        f"api:v1:organization:organization-{action}",
        kwargs={"uuid": org.uuid},
    )


@pytest.mark.django_db
class TestMyAction:
    def test_my_returns_only_member_orgs(self):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        client = _member_client(org_a, "organization.view")

        response = client.get(
            reverse("api:v1:organization:organization-my"), **_org_header(org_a)
        )

        assert response.status_code == 200
        ids = [row["id"] for row in response.data["results"]]
        assert ids == [str(org_a.id)]
        assert str(org_b.id) not in ids

    def test_my_unauthenticated(self, api_client):
        response = api_client.get(reverse("api:v1:organization:organization-my"))

        assert response.status_code == 401


@pytest.mark.django_db
class TestArchiveAction:
    def test_archive_sets_archived_status(self, staff_client):
        org = OrganizationFactory.create(status="active")

        response = staff_client.post(_action_url(org, "archive"), **_org_header(org))

        assert response.status_code == 200
        org.refresh_from_db()
        assert org.status == "archived"
        # Archive is a lifecycle transition, not a delete.
        assert org.is_deleted is False
        assert org.pk is not None

    def test_archive_requires_permission(self):
        org = OrganizationFactory.create(status="active")
        client = _member_client(org, "organization.view")

        response = client.post(_action_url(org, "archive"), **_org_header(org))

        assert response.status_code == 403
        org.refresh_from_db()
        assert org.status == "active"

    def test_archive_unauthenticated(self, api_client):
        org = OrganizationFactory.create(status="active")

        response = api_client.post(_action_url(org, "archive"))

        assert response.status_code == 401

    def test_archive_falls_back_to_soft_delete(self, staff_client):
        """Service failure still archives via soft delete (no 500, no loss)."""
        from unittest import mock

        from apps.organization.services import OrganizationService

        org = OrganizationFactory.create(status="active")
        with mock.patch.object(
            OrganizationService, "archive", side_effect=RuntimeError("boom")
        ):
            response = staff_client.post(_action_url(org, "archive"), **_org_header(org))

        assert response.status_code == 200, response.data
        org.refresh_from_db()
        assert org.is_deleted is True
        # Row survives for restore.
        assert Organization.all_objects.filter(pk=org.pk).exists()

    def test_archive_unknown_org_404(self, staff_client):
        org = OrganizationFactory.create()
        url = reverse(
            "api:v1:organization:organization-archive",
            kwargs={"uuid": "00000000-0000-0000-0000-000000000000"},
        )

        response = staff_client.post(url, **_org_header(org))

        assert response.status_code == 404


@pytest.mark.django_db
class TestRestoreAction:
    def test_restore_soft_deleted(self, staff_client):
        org = OrganizationFactory.create()
        org.delete()
        assert org.is_deleted is True

        response = staff_client.post(_action_url(org, "restore"), **_org_header(org))

        assert response.status_code == 200
        org.refresh_from_db()
        assert org.is_deleted is False
        assert org.deleted_at is None

    def test_restore_active_404s(self, staff_client):
        # Invalid transition (Active → Restore): nothing deleted to restore.
        # Matches the client/vendor restore precedent (deleted-only scope).
        org = OrganizationFactory.create(status="active")

        response = staff_client.post(_action_url(org, "restore"), **_org_header(org))

        assert response.status_code == 404
        org.refresh_from_db()
        assert org.is_deleted is False
        assert org.status == "active"

    def test_restore_requires_permission(self):
        org = OrganizationFactory.create()
        org.delete()
        client = _member_client(org, "organization.view")

        response = client.post(_action_url(org, "restore"), **_org_header(org))

        assert response.status_code == 403
        org.refresh_from_db()
        assert org.is_deleted is True

    def test_member_restore_denied_fail_closed(self):
        # Even with `organization.update`, a member cannot restore: the deleted
        # org yields no permission context, so the check fails closed (staff-only
        # restore). Default DENY per the authorization model.
        org = OrganizationFactory.create()
        org.delete()
        client = _member_client(org, "organization.update")

        response = client.post(_action_url(org, "restore"), **_org_header(org))

        assert response.status_code == 403
        org.refresh_from_db()
        assert org.is_deleted is True

    def test_member_cannot_restore_foreign_deleted_org(self):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        org_b.delete()
        client = _member_client(org_a, "organization.update")

        response = client.post(_action_url(org_b, "restore"), **_org_header(org_a))

        assert response.status_code == 404
        org_b.refresh_from_db()
        assert org_b.is_deleted is True

    def test_restore_malformed_lookup_404s(self, staff_client):
        org = OrganizationFactory.create()
        url = reverse(
            "api:v1:organization:organization-restore",
            kwargs={"uuid": "not-a-uuid"},
        )

        response = staff_client.post(url, **_org_header(org))

        assert response.status_code == 404


@pytest.mark.django_db
class TestExportAction:
    def test_export_returns_download_url(self, staff_client):
        org = OrganizationFactory.create()

        response = staff_client.post(_action_url(org, "export"), **_org_header(org))

        assert response.status_code == 200
        assert response.data["download_url"].endswith(f"{org.id}.zip")

    def test_export_unknown_org_404(self, staff_client):
        org = OrganizationFactory.create()
        other = OrganizationFactory.create()
        url = _action_url(other, "export")

        response = staff_client.post(url, **_org_header(org))

        # Staff sees all orgs, so an existing org exports fine…
        assert response.status_code == 200

        missing = url.replace(str(other.uuid), "00000000-0000-0000-0000-000000000000")
        response = staff_client.post(missing, **_org_header(org))
        assert response.status_code == 404


@pytest.mark.django_db
class TestSwitchAction:
    def test_switch_returns_success(self, staff_client):
        org = OrganizationFactory.create()

        response = staff_client.post(_action_url(org, "switch"), **_org_header(org))

        assert response.status_code == 200
        assert response.data == {"success": True}

    def test_switch_unauthenticated(self, api_client):
        org = OrganizationFactory.create()

        response = api_client.post(_action_url(org, "switch"))

        assert response.status_code == 401


@pytest.mark.django_db
class TestSettingsAction:
    def test_get_creates_and_returns_settings(self, staff_client):
        org = OrganizationFactory.create()

        response = staff_client.get(_action_url(org, "settings"), **_org_header(org))

        assert response.status_code == 200
        assert response.data["timezone"] == "UTC"
        assert response.data["language"] == "en"

    def test_patch_flat_payload(self, staff_client):
        org = OrganizationFactory.create()

        response = staff_client.patch(
            _action_url(org, "settings"),
            {"timezone": "Asia/Kolkata"},
            format="json",
            **_org_header(org),
        )

        assert response.status_code == 200, response.data
        assert response.data["timezone"] == "Asia/Kolkata"

    def test_patch_nested_settings_payload(self, staff_client):
        org = OrganizationFactory.create()

        response = staff_client.patch(
            _action_url(org, "settings"),
            {"settings": {"language": "fr"}},
            format="json",
            **_org_header(org),
        )

        assert response.status_code == 200, response.data
        assert response.data["language"] == "fr"

    def test_settings_unauthenticated(self, api_client):
        org = OrganizationFactory.create()

        response = api_client.get(_action_url(org, "settings"))

        assert response.status_code == 401
