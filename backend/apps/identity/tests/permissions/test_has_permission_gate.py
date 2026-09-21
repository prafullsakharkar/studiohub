"""
HasPermission gate tests: deny-by-default, no staff bypass, superuser
break-glass, and the object-level organization consistency check.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient, APIRequestFactory

from apps.identity.permissions.permission import HasPermission
from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
    PermissionFactory,
    RoleFactory,
    RolePermissionFactory,
    UserRoleFactory,
)


class _StubView:
    def __init__(self, action, permission_map):
        self.action = action
        self.permission_map = permission_map

    def get_permission_required(self):
        if self.action not in self.permission_map:
            return None
        permissions = self.permission_map[self.action]
        return permissions or ()


def _request(user, organization=None):
    factory = APIRequestFactory()
    request = factory.get("/")
    request.user = user
    request.organization = organization
    return request


@pytest.mark.django_db
class TestHasPermissionGate:
    def test_missing_map_entry_denies(self):
        user = UserFactory.create()
        gate = HasPermission()
        view = _StubView("undeclared_action", {})
        assert gate.has_permission(_request(user), view) is False

    def test_explicit_open_entry_allows(self):
        user = UserFactory.create()
        gate = HasPermission()
        view = _StubView("me", {"me": ()})
        assert gate.has_permission(_request(user), view) is True

    def test_staff_without_grant_denied(self):
        staff = UserFactory.create(is_staff=True)
        PermissionFactory.create(code="gate.staff.probe")
        gate = HasPermission()
        view = _StubView("probe", {"probe": ("gate.staff.probe",)})
        assert gate.has_permission(_request(staff), view) is False

    def test_staff_with_grant_allowed(self):
        from apps.organization.tests.rbac_helpers import grant_permissions

        staff = UserFactory.create(is_staff=True)
        grant_permissions(staff, "gate.staff.granted")
        gate = HasPermission()
        view = _StubView("probe", {"probe": ("gate.staff.granted",)})
        assert gate.has_permission(_request(staff), view) is True

    def test_superuser_bypass_allowed(self):
        admin = UserFactory.create(is_staff=True, is_superuser=True)
        gate = HasPermission()
        view = _StubView("probe", {"probe": ("gate.superuser.anything",)})
        assert gate.has_permission(_request(admin), view) is True

    def test_object_org_mismatch_denied(self):
        from apps.organization.tests.rbac_helpers import grant_permissions

        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        user = UserFactory.create()
        grant_permissions(user, "gate.object.probe", organization=org_a)

        class _Obj:
            pass

        obj = _Obj()
        obj.organization = org_b
        gate = HasPermission()
        view = _StubView("probe", {"probe": ("gate.object.probe",)})
        assert gate.has_object_permission(_request(user, org_a), view, obj) is False

    def test_object_same_org_allowed(self):
        org = OrganizationFactory.create()
        user = UserFactory.create()

        class _Obj:
            pass

        obj = _Obj()
        obj.organization = org
        gate = HasPermission()
        view = _StubView("probe", {"probe": ("gate.object.probe",)})
        assert gate.has_object_permission(_request(user, org), view, obj) is True


@pytest.mark.django_db
class TestPermissionResolverFilters:
    def test_inactive_user_resolves_empty(self):
        from apps.identity.resolvers.permission import PermissionResolver

        user = UserFactory.create(is_active=False)
        role = RoleFactory.create()
        permission = PermissionFactory.create(code="gate.inactive.user")
        RolePermissionFactory.create(role=role, permission=permission)
        UserRoleFactory.create(user=user, role=role)
        assert PermissionResolver.resolve(user=user) == set()

    def test_suspended_membership_confes_nothing(self):
        from apps.identity.resolvers.permission import PermissionResolver

        org = OrganizationFactory.create()
        user = UserFactory.create()
        role = RoleFactory.create(organization=org)
        permission = PermissionFactory.create(code="gate.suspended.membership")
        RolePermissionFactory.create(role=role, permission=permission)
        OrganizationMembershipFactory.create(
            user=user, organization=org, role=role, status="suspended"
        )
        assert permission.code not in PermissionResolver.resolve(
            user=user, organization=org
        )

    def test_revoked_grant_confes_nothing(self):
        from apps.identity.resolvers.permission import PermissionResolver

        user = UserFactory.create()
        role = RoleFactory.create()
        permission = PermissionFactory.create(code="gate.revoked.grant")
        RolePermissionFactory.create(role=role, permission=permission, granted=False)
        UserRoleFactory.create(user=user, role=role)
        assert permission.code not in PermissionResolver.resolve(user=user)

    def test_inactive_role_confes_nothing(self):
        from apps.identity.resolvers.permission import PermissionResolver

        user = UserFactory.create()
        role = RoleFactory.create(is_active=False)
        permission = PermissionFactory.create(code="gate.inactive.role")
        RolePermissionFactory.create(role=role, permission=permission)
        UserRoleFactory.create(user=user, role=role)
        assert permission.code not in PermissionResolver.resolve(user=user)

    def test_inactive_permission_confes_nothing(self):
        from apps.identity.resolvers.permission import PermissionResolver

        user = UserFactory.create()
        role = RoleFactory.create()
        permission = PermissionFactory.create(
            code="gate.inactive.permission", is_active=False
        )
        RolePermissionFactory.create(role=role, permission=permission)
        UserRoleFactory.create(user=user, role=role)
        assert permission.code not in PermissionResolver.resolve(user=user)

    def test_org_scoped_role_does_not_leak(self):
        from apps.identity.resolvers.permission import PermissionResolver

        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        user = UserFactory.create()
        role = RoleFactory.create(organization=org_a)
        permission = PermissionFactory.create(code="gate.scoped.role")
        RolePermissionFactory.create(role=role, permission=permission)
        UserRoleFactory.create(user=user, role=role)
        assert permission.code in PermissionResolver.resolve(
            user=user, organization=org_a
        )
        assert permission.code not in PermissionResolver.resolve(
            user=user, organization=org_b
        )
        assert permission.code not in PermissionResolver.resolve(user=user)

    def test_global_role_applies_in_org(self):
        from apps.identity.resolvers.permission import PermissionResolver

        org = OrganizationFactory.create()
        user = UserFactory.create()
        role = RoleFactory.create(organization=None)
        permission = PermissionFactory.create(code="gate.global.role")
        RolePermissionFactory.create(role=role, permission=permission)
        UserRoleFactory.create(user=user, role=role)
        assert permission.code in PermissionResolver.resolve(
            user=user, organization=org
        )


@pytest.mark.django_db
class TestStaffBypassRemovedAPI:
    """End-to-end: bare staff gets 403 on coded endpoints, superuser passes."""

    def test_bare_staff_denied_coded_endpoint(self):
        staff = UserFactory.create(is_staff=True)
        client = APIClient()
        client.force_authenticate(user=staff)
        response = client.get("/api/v1/identity/ip-blacklist/")
        assert response.status_code == 403

    def test_superuser_allowed_coded_endpoint(self):
        admin = UserFactory.create(is_staff=True, is_superuser=True)
        client = APIClient()
        client.force_authenticate(user=admin)
        response = client.get("/api/v1/identity/ip-blacklist/")
        assert response.status_code == 200
