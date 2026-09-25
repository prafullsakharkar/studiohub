"""
Phase 12 — Privilege-escalation & tenant-isolation security suite (ADR-0033).

These test the *deny* surface deliberately (not the happy path):

- cross-organization detail/list reads through forged headers
- cross-project entity detail
- writes without permission codes (403)
- bulk archive/restore scoped to member projects (no out-of-scope mutation)
- permission/role modification without grants denied
- membership removal revokes access
- deactivated user access revoked
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import (
    DepartmentFactory,
    OrganizationFactory,
    OrganizationMembershipFactory,
)
from apps.organization.tests.rbac_helpers import grant_org_admin, grant_permissions
from apps.production.tests.factories import ProjectFactory, ShotFactory


def _client(user, org=None):
    client = APIClient()
    client.force_authenticate(user=user)
    if org is not None:
        client.defaults["HTTP_X_ORGANIZATION_ID"] = str(org.pk)
    return client


@pytest.mark.django_db
class TestCrossOrganizationBoundary:
    def test_non_member_org_header_yields_no_org_entities(self):
        """A forged X-Organization-Id for a non-member org yields nothing."""
        user = UserFactory.create()
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        grant_org_admin(user, org_a)
        DepartmentFactory.create(organization=org_b)

        response = _client(user, org_b).get("/api/v1/departments/")
        # canonical fail-closed: 403 (no permission in that org) or 200-empty
        if response.status_code == 200:
            assert response.data.get("results", response.data) == []
        else:
            assert response.status_code == 403

        # the detail of a non-member org is denied (existence not revealed:
        # 404 unknown / 403 forbidden are both acceptable fail-closed shapes)
        response = _client(user, org_b).get(f"/api/v1/organizations/{org_b.pk}/")
        assert response.status_code in (403, 404)

    def test_cross_org_production_detail_is_hidden(self):
        user = UserFactory.create()
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        grant_org_admin(user, org_a)
        shot = ShotFactory.create(organization=org_b, project=ProjectFactory.create(organization=org_b))

        # even with the caller's own org header, the cross-org id 404s
        response = _client(user, org_a).get(f"/api/v1/shots/{shot.pk}/")
        assert response.status_code == 404


@pytest.mark.django_db
class TestCrossProjectIsolation:
    def test_shot_detail_from_other_project_is_404_for_non_member(self):
        org = OrganizationFactory.create()
        project_member = ProjectFactory.create(organization=org, code="IN")
        other = ProjectFactory.create(organization=org, code="OUT")
        shot = ShotFactory.create(organization=org, project=other)

        user = UserFactory.create()
        grant_permissions(user, "shot.view", organization=org)
        from apps.production.models.project_membership import ProjectMembership

        ProjectMembership.objects.create(
            user=user, organization=org, project=project_member, status="Active"
        )

        response = _client(user, org).get(f"/api/v1/shots/{shot.pk}/")
        assert response.status_code == 404


@pytest.mark.django_db
class TestUnauthorizedWrites:
    def test_create_shot_without_grant_denied(self):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        user = UserFactory.create()
        OrganizationMembershipFactory.create(user=user, organization=org, status="active")
        from apps.production.models.project_membership import ProjectMembership

        ProjectMembership.objects.create(
            user=user, organization=org, project=project, status="Active"
        )

        response = _client(user, org).post(
            "/api/v1/shots/",
            data={"project": str(project.pk), "code": "SH-X1", "name": "Denied"},
            format="json",
        )
        assert response.status_code == 403
        from apps.production.models import Shot

        assert not Shot.objects.filter(code="SH-X1").exists()

    def test_role_grant_endpoint_denied_for_regular_members(self):
        org = OrganizationFactory.create()
        user = UserFactory.create()
        grant_permissions(user, "organization.view", organization=org)
        from apps.organization.tests.factories import RoleFactory
        from apps.organization.tests.rbac_helpers import ensure_permission
        from apps.organization.models import RolePermission

        role = RoleFactory.create(organization=org)
        perm = ensure_permission("role.assign")

        response = _client(user, org).post(
            f"/api/v1/roles/{role.pk}/add_permissions/",
            data={"permissions": [perm.code]},
            format="json",
        )
        assert response.status_code in (403, 404)
        assert not RolePermission.objects.filter(role=role, permission=perm).exists()


@pytest.mark.django_db
class TestMembershipRevocation:
    def test_removing_membership_revokes_access(self):
        user = UserFactory.create()
        org = OrganizationFactory.create()
        membership = grant_org_admin(user, org)  # active membership w/ admin role

        member_response = _client(user, org).get("/api/v1/organizations/")
        ids = [o["id"] for o in (member_response.data.get("results") or member_response.data)]
        assert str(org.pk) in ids

        # revoke: soft-delete the membership
        from apps.organization.models import OrganizationMembership

        OrganizationMembership.objects.filter(user=user, organization=org).delete()

        revoked = _client(user, org).get("/api/v1/organizations/")
        if revoked.status_code == 200:
            data = revoked.data
            rows = data.get("results") if isinstance(data, dict) else data
            ids = [o["id"] for o in (rows or [])]
            assert str(org.pk) not in ids
        else:
            # fail-closed denial also satisfies revocation
            assert revoked.status_code in (401, 403)


@pytest.mark.django_db
class TestDeactivatedUser:
    def test_inactive_user_denied_at_api(self):
        org = OrganizationFactory.create()
        ProjectFactory.create(organization=org)
        user = UserFactory.create(is_active=False)
        grant_org_admin(user, org)

        response = _client(user, org).get("/api/v1/projects/")
        assert response.status_code in (401, 403)


@pytest.mark.django_db
class TestBulkScoping:
    def test_bulk_archive_skips_out_of_scope_ids_without_leak(self):
        org = OrganizationFactory.create()
        in_project = ProjectFactory.create(organization=org, code="INP")
        out_project = ProjectFactory.create(organization=org, code="OUTP")
        in_shot = ShotFactory.create(organization=org, project=in_project, code="SH-IN")
        out_shot = ShotFactory.create(organization=org, project=out_project, code="SH-OUT")

        user = UserFactory.create()
        # org member with delete grant across the org, but project membership only for in_project
        grant_permissions(user, "shot.view", "shot.delete", organization=org)
        from apps.production.models.project_membership import ProjectMembership

        ProjectMembership.objects.create(
            user=user, organization=org, project=in_project, status="Active"
        )

        response = _client(user, org).post(
            "/api/v1/shots/bulk-archive/",
            data={"ids": [str(in_shot.pk), str(out_shot.pk)]},
            format="json",
        )
        assert response.status_code == 200
        in_shot.refresh_from_db()
        out_shot.refresh_from_db()
        assert in_shot.is_deleted is True
        assert out_shot.is_deleted is False  # not in scope — untouched


@pytest.mark.django_db
class TestUnauthorizedExport:
    def test_organization_export_requires_grant(self):
        org = OrganizationFactory.create()
        user = UserFactory.create()
        OrganizationMembershipFactory.create(user=user, organization=org, status="active")

        response = _client(user, org).post(
            f"/api/v1/organizations/{org.pk}/export/",
            format="json",
        )
        assert response.status_code in (403, 404)
