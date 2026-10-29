from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.identity.models import Role, RolePermission, UserRole
from apps.identity.resolvers.permission import PermissionResolver
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import ensure_permission


@pytest.mark.django_db
class TestGrantExpiry:
    def test_expired_grant_does_not_resolve(self):
        user = UserFactory.create()
        role = Role.objects.create(name="R", code="role-expiry")
        permission = ensure_permission("shot.probe.expired")
        RolePermission.objects.create(
            role=role,
            permission=permission,
            granted=True,
            expires_at=timezone.now() - timedelta(days=1),
        )
        UserRole.objects.create(user=user, role=role)

        resolved = PermissionResolver.resolve(user=user)
        assert "shot.probe.expired" not in resolved

    def test_denied_row_never_grants(self):
        user = UserFactory.create()
        role = Role.objects.create(name="R2", code="role-deny")
        permission = ensure_permission("shot.probe.denied")
        RolePermission.objects.create(
            role=role,
            permission=permission,
            granted=False,
        )
        UserRole.objects.create(user=user, role=role)

        resolved = PermissionResolver.resolve(user=user)
        assert "shot.probe.denied" not in resolved
