"""
Permission revocation tests: grants revoked through services take effect
immediately (write-through cache invalidation — no TTL wait).
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.services.permission_cache import PermissionCacheService
from apps.identity.tests.factories import UserFactory
from apps.organization.constants.permissions import DepartmentPermissions
from apps.organization.services.membership import OrganizationMembershipService
from apps.organization.services.role import RoleService
from apps.organization.tests.factories import (
    DepartmentFactory,
    OrganizationFactory,
    OrganizationMembershipFactory,
    PermissionFactory,
    RoleFactory,
    RolePermissionFactory,
    UserRoleFactory,
)


def _hdr(org):
    return {"HTTP_X_ORGANIZATION_ID": str(org.id)}


def _client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestRevocationTakesEffectImmediately:
    def test_role_revoke_denies_at_once(self):
        org = OrganizationFactory.create()
        user = UserFactory.create()
        role = RoleFactory.create(organization=org)
        permission = PermissionFactory.create(code=DepartmentPermissions.VIEW)
        RolePermissionFactory.create(role=role, permission=permission, granted=True)
        OrganizationMembershipFactory.create(
            user=user, organization=org, role=role
        )
        client = _client_for(user)

        url = "/api/v1/organization/departments/"
        assert client.get(url, **_hdr(org)).status_code == 200

        RoleService.revoke_permissions(role, [DepartmentPermissions.VIEW])

        assert client.get(url, **_hdr(org)).status_code == 403
        assert (
            DepartmentPermissions.VIEW
            not in PermissionCacheService.get_permissions(
                user=user, organization=org
            )
        )

    def test_unassign_user_denies_at_once(self):
        org = OrganizationFactory.create()
        user = UserFactory.create()
        role = RoleFactory.create(organization=org)
        permission = PermissionFactory.create(code="revoke.probe.view")
        RolePermissionFactory.create(role=role, permission=permission, granted=True)
        UserRoleFactory.create(user=user, role=role)

        assert PermissionCacheService.has_permission(
            user=user, permission=permission.code, organization=org
        )

        RoleService.unassign_user(role, str(user.id))

        assert not PermissionCacheService.has_permission(
            user=user, permission=permission.code, organization=org
        )

    def test_membership_suspend_denies_at_once(self):
        org = OrganizationFactory.create()
        user = UserFactory.create()
        role = RoleFactory.create(organization=org)
        permission = PermissionFactory.create(code=DepartmentPermissions.VIEW)
        RolePermissionFactory.create(role=role, permission=permission, granted=True)
        membership = OrganizationMembershipFactory.create(
            user=user, organization=org, role=role
        )
        client = _client_for(user)

        url = "/api/v1/organization/departments/"
        assert client.get(url, **_hdr(org)).status_code == 200

        OrganizationMembershipService.suspend(membership)

        assert client.get(url, **_hdr(org)).status_code == 403

    def test_regrant_after_revoke_allows(self):
        org = OrganizationFactory.create()
        user = UserFactory.create()
        role = RoleFactory.create(organization=org)
        permission = PermissionFactory.create(code="revoke.regrant.view")
        RolePermissionFactory.create(role=role, permission=permission, granted=True)
        UserRoleFactory.create(user=user, role=role)

        assert PermissionCacheService.has_permission(
            user=user, permission=permission.code, organization=org
        )
        RoleService.revoke_permissions(role, [permission.code])
        assert not PermissionCacheService.has_permission(
            user=user, permission=permission.code, organization=org
        )
        # Re-granting a revoked row must flip granted back (not leave denial).
        added, _ = RoleService.grant_permissions(role, [permission.code])
        assert added == [permission.code]
        assert PermissionCacheService.has_permission(
            user=user, permission=permission.code, organization=org
        )

    def test_department_list_scoped_and_granted(self):
        org = OrganizationFactory.create()
        user = UserFactory.create()
        role = RoleFactory.create(organization=org)
        permission = PermissionFactory.create(code=DepartmentPermissions.VIEW)
        RolePermissionFactory.create(role=role, permission=permission, granted=True)
        OrganizationMembershipFactory.create(user=user, organization=org, role=role)
        DepartmentFactory.create(organization=org)
        client = _client_for(user)

        response = client.get("/api/v1/organization/departments/", **_hdr(org))
        assert response.status_code == 200
