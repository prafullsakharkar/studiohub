"""
RolePermission table rename (N8 consolidation).

Asserts the singular table name with rows preserved and the unique
(role, permission) grant path intact.
"""

from __future__ import annotations

import pytest

from apps.organization.models import (
    Organization,
    Permission,
    Role,
    RolePermission,
)
from apps.organization.tests.factories import (
    OrganizationFactory,
    PermissionFactory,
    RoleFactory,
)


@pytest.mark.django_db
def test_role_permission_table_is_singular_and_preserves_rows():
    org = OrganizationFactory.create()
    role = RoleFactory.create(code="rp-tester", name="RP Tester", organization=org)
    perm = PermissionFactory.create(
        code="rp.probe", module="role", action="view", category="roles"
    )
    RolePermission.objects.create(role=role, permission=perm)

    assert RolePermission._meta.db_table == "organization_role_permission"
    assert RolePermission.objects.filter(role=role, permission=perm).count() == 1


@pytest.mark.django_db
def test_role_permission_unique_grant_preserved():
    from django.db import IntegrityError

    org = OrganizationFactory.create()
    role = RoleFactory.create(code="rp-tester2", name="RP Tester 2", organization=org)
    perm = PermissionFactory.create(
        code="rp.probe2", module="role", action="view", category="roles"
    )
    RolePermission.objects.create(role=role, permission=perm)

    with pytest.raises(IntegrityError):
        RolePermission.objects.create(role=role, permission=perm)
