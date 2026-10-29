"""
HasPermission gate tests: deny-by-default, no staff bypass, superuser
break-glass, and the platform-global object check.

Resolution is platform-global: grants flow through identity Role ->
RolePermission -> Permission rows assigned via UserRole (direct) or
GroupRole + live GroupMember rows (group-conferred). There is no
organization scoping.
"""

from __future__ import annotations

import uuid

import pytest
from rest_framework.test import APIClient, APIRequestFactory

from apps.identity.models import (
    Group,
    GroupMember,
    GroupRole,
    Role,
    RolePermission,
    UserRole,
)
from apps.identity.permissions.permission import HasPermission
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import ensure_permission, grant_permissions


def _unique_code(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def _make_role(**kwargs) -> Role:
    kwargs.setdefault("name", f"Role {uuid.uuid4().hex[:8]}")
    kwargs.setdefault("code", _unique_code("role"))
    kwargs.setdefault("is_active", True)
    return Role.objects.create(**kwargs)


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
        ensure_permission("gate.staff.probe")
        gate = HasPermission()
        view = _StubView("probe", {"probe": ("gate.staff.probe",)})
        assert gate.has_permission(_request(staff), view) is False

    def test_staff_with_grant_allowed(self):
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

    def test_object_check_is_global(self):
        # Platform-global resources have no org partition, so the
        # object check never denies on org mismatch.
        user = UserFactory.create()
        grant_permissions(user, "gate.object.probe")

        class _Obj:
            pass

        obj = _Obj()
        obj.organization = "some-other-org"
        gate = HasPermission()
        view = _StubView("probe", {"probe": ("gate.object.probe",)})
        assert gate.has_object_permission(_request(user), view, obj) is True

    def test_object_check_allows_without_org(self):
        user = UserFactory.create()

        class _Obj:
            pass

        gate = HasPermission()
        view = _StubView("probe", {"probe": ("gate.object.probe",)})
        assert gate.has_object_permission(_request(user), view, _Obj()) is True


@pytest.mark.django_db
class TestPermissionResolverFilters:
    def test_inactive_user_resolves_empty(self):
        from apps.identity.resolvers.permission import PermissionResolver

        user = UserFactory.create(is_active=False)
        role = _make_role()
        permission = ensure_permission("gate.inactive.user")
        RolePermission.objects.create(role=role, permission=permission)
        UserRole.objects.create(user=user, role=role)
        assert PermissionResolver.resolve(user=user) == set()

    def test_direct_grant_resolves(self):
        from apps.identity.resolvers.permission import PermissionResolver

        user = UserFactory.create()
        grant_permissions(user, "gate.direct.grant")
        assert "gate.direct.grant" in PermissionResolver.resolve(user=user)

    def test_group_grant_resolves(self):
        from apps.identity.resolvers.permission import PermissionResolver

        user = UserFactory.create()
        role = _make_role()
        permission = ensure_permission("gate.group.grant")
        RolePermission.objects.create(role=role, permission=permission)
        group = Group.objects.create(
            code=_unique_code("group"), name="G", is_deleted=False
        )
        GroupMember.objects.create(group=group, user=user)
        GroupRole.objects.create(group=group, role=role)
        assert "gate.group.grant" in PermissionResolver.resolve(user=user)

    def test_soft_deleted_group_membership_confers_nothing(self):
        from apps.identity.resolvers.permission import PermissionResolver

        user = UserFactory.create()
        role = _make_role()
        permission = ensure_permission("gate.soft.deleted.membership")
        RolePermission.objects.create(role=role, permission=permission)
        group = Group.objects.create(
            code=_unique_code("group"), name="G", is_deleted=False
        )
        GroupMember.objects.create(group=group, user=user, is_deleted=True)
        GroupRole.objects.create(group=group, role=role)
        assert permission.code not in PermissionResolver.resolve(user=user)

    def test_revoked_grant_confes_nothing(self):
        from apps.identity.resolvers.permission import PermissionResolver

        user = UserFactory.create()
        role = _make_role()
        permission = ensure_permission("gate.revoked.grant")
        RolePermission.objects.create(role=role, permission=permission, granted=False)
        UserRole.objects.create(user=user, role=role)
        assert permission.code not in PermissionResolver.resolve(user=user)

    def test_inactive_role_confes_nothing(self):
        from apps.identity.resolvers.permission import PermissionResolver

        user = UserFactory.create()
        role = _make_role(is_active=False)
        permission = ensure_permission("gate.inactive.role")
        RolePermission.objects.create(role=role, permission=permission)
        UserRole.objects.create(user=user, role=role)
        assert permission.code not in PermissionResolver.resolve(user=user)

    def test_inactive_permission_confes_nothing(self):
        from apps.identity.resolvers.permission import PermissionResolver

        user = UserFactory.create()
        role = _make_role()
        permission = ensure_permission("gate.inactive.permission")
        permission.is_active = False
        permission.save(update_fields=["is_active", "updated_at"])
        RolePermission.objects.create(role=role, permission=permission)
        UserRole.objects.create(user=user, role=role)
        assert permission.code not in PermissionResolver.resolve(user=user)

    def test_ungranted_user_resolves_empty(self):
        from apps.identity.resolvers.permission import PermissionResolver

        user = UserFactory.create()
        assert PermissionResolver.resolve(user=user) == set()

    def test_cache_key_has_no_org_segment(self):
        from apps.identity.services.permission_cache import get_permission_cache_key

        key = get_permission_cache_key("user-1")
        assert key == "identity.permission:user-1:1"
        assert "global" not in key


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
