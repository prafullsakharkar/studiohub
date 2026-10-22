from __future__ import annotations

import pytest
from django.utils import timezone

from apps.identity.models import (
    Group,
    GroupMember,
    GroupRole,
    Role,
    RolePermission,
    UserRole,
)
from apps.identity.resolvers.permission import PermissionResolver
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import ensure_permission


@pytest.mark.django_db
class TestGroupMemberLeftAtScoping:
    """DOM-RBAC-01 rule 3: a departed member (left_at set) loses group-role
    permissions immediately; an active member keeps them."""

    def _setup(self):
        user = UserFactory.create()
        group = Group.objects.create(name="Departed Group", code="departed-group")
        role = Role.objects.create(name="Departed Role", code="departed-role")
        permission = ensure_permission("shot.probe.departed")
        RolePermission.objects.create(
            role=role,
            permission=permission,
            granted=True,
        )
        GroupRole.objects.create(group=group, role=role)
        return user, group

    def test_active_member_resolves_group_role_permissions(self):
        user, group = self._setup()
        GroupMember.objects.create(group=group, user=user)

        resolved = PermissionResolver.resolve(user=user)
        assert "shot.probe.departed" in resolved

    def test_departed_member_loses_group_role_permissions(self):
        user, group = self._setup()
        GroupMember.objects.create(
            group=group,
            user=user,
            left_at=timezone.now(),
        )

        resolved = PermissionResolver.resolve(user=user)
        assert "shot.probe.departed" not in resolved

    def test_departed_member_keeps_direct_role_permissions(self):
        user, group = self._setup()
        GroupMember.objects.create(
            group=group,
            user=user,
            left_at=timezone.now(),
        )
        # A direct assignment is independent of group membership.
        role = Role.objects.create(name="Direct Role", code="direct-role")
        RolePermission.objects.create(
            role=role,
            permission=ensure_permission("shot.probe.direct"),
            granted=True,
        )
        UserRole.objects.create(user=user, role=role)

        resolved = PermissionResolver.resolve(user=user)
        assert "shot.probe.direct" in resolved
