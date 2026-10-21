from __future__ import annotations

import pytest

from apps.identity.models import Role, UserRole
from apps.identity.services.permission_cache import PermissionCacheService
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_all_known_codes


@pytest.mark.django_db
class TestRbacCacheInvalidation:
    def test_userrole_write_bumps_cache_version(self):
        user = UserFactory.create()
        grant_all_known_codes(user)
        before = PermissionCacheService.get_permissions(
            user=user,
        )
        assert before  # baseline has grants

        role = Role.objects.create(
            name="Probe Role",
            code="probe-role",
        )

        def _version():
            from django.core.cache import cache

            return cache.get(
                f"identity.permission.version:{user.pk}",
                1,
            )

        v0 = _version()
        UserRole.objects.create(user=user, role=role)
        v1 = _version()
        assert v1 == v0 + 1

    def test_rolepermission_delete_bumps_holder_versions(self):
        user = UserFactory.create()
        role = grant_all_known_codes(user)
        from apps.identity.models import RolePermission

        rp = RolePermission.objects.filter(role=role).first()
        assert rp is not None

        def _version():
            from django.core.cache import cache

            return cache.get(
                f"identity.permission.version:{user.pk}",
                1,
            )

        v0 = _version()
        rp.delete()
        v1 = _version()
        assert v1 == v0 + 1
