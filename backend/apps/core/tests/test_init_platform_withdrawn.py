"""
`init_platform` withdraws the grants the role matrix removed (docs/delivery-pipeline Q34, Q40 = A).

The command used to only add grants, so rerunning it on an existing database never took
`delivery.delete` or `publishing.delete` away from the vfx-supervisor. It now removes the codes in
`WITHDRAWN_GRANTS` from the seeded system roles, on every run, and only those.
"""

from __future__ import annotations

from io import StringIO

import pytest
from django.core.management import call_command

from apps.core.management.commands.init_platform import (
    PERMISSION_SPECS,
    ROLE_SPECS,
    WITHDRAWN_GRANTS,
    Command,
)

pytestmark = pytest.mark.django_db

OLD_GRANTS = ("publishing.delete", "delivery.delete", "delivery.send", "delivery.view_secret")


def _codes(role_code: str) -> set[str]:
    from apps.identity.models import RolePermission

    return set(
        RolePermission.all_objects.filter(role__code=role_code).values_list(
            "permission__code", flat=True
        )
    )


def _give(role_code: str, *codes: str) -> None:
    """Put grants on a seeded role the way an older database has them."""
    from apps.identity.models import Permission, Role, RolePermission

    role = Role.objects.get(code=role_code)
    for code in codes:
        RolePermission.objects.get_or_create(
            role=role, permission=Permission.objects.get(code=code), defaults={"granted": True}
        )


def _run() -> str:
    out = StringIO()
    call_command("init_platform", stdout=out)
    return out.getvalue()


@pytest.fixture
def old_database():
    """A database seeded before the matrix changed: the vfx-supervisor still holds the old codes."""
    _run()
    _give("vfx-supervisor", *OLD_GRANTS)
    assert set(OLD_GRANTS) <= _codes("vfx-supervisor")


def test_a_rerun_removes_the_withdrawn_grants(old_database):
    output = _run()

    assert not set(OLD_GRANTS) & _codes("vfx-supervisor")
    assert f"{len(OLD_GRANTS)} withdrawn role grants removed" in output


def test_it_removes_only_the_withdrawn_grants(old_database):
    before = _codes("vfx-supervisor") - set(OLD_GRANTS)

    _run()

    after = _codes("vfx-supervisor")
    assert after == before
    assert {"delivery.view", "delivery.create", "delivery.update", "delivery.approve"} <= after


def test_other_roles_keep_the_same_codes(old_database):
    before = {
        role["code"]: _codes(role["code"])
        for role in ROLE_SPECS
        if role["code"] != "vfx-supervisor"
    }

    _run()

    for code, granted in before.items():
        assert _codes(code) == granted, code
    assert {
        "delivery.delete",
        "delivery.send",
        "delivery.view_secret",
        "publishing.delete",
    } <= _codes("production-admin")


def test_a_second_rerun_removes_nothing(old_database):
    _run()

    output = _run()

    assert "withdrawn" not in output


def test_the_holders_cached_permission_goes_with_the_grant(old_database):
    from apps.identity.models import Role, UserRole
    from apps.identity.services.permission_cache import PermissionCacheService
    from apps.identity.tests.factories import UserFactory

    user = UserFactory.create()
    UserRole.objects.create(user=user, role=Role.objects.get(code="vfx-supervisor"))
    PermissionCacheService.invalidate(user=user)
    assert PermissionCacheService.has_permission(user=user, permission="delivery.delete")

    _run()

    assert not PermissionCacheService.has_permission(user=user, permission="delivery.delete")
    assert PermissionCacheService.has_permission(user=user, permission="delivery.approve")


def test_a_role_that_is_not_a_system_role_is_left_alone(old_database):
    from apps.identity.models import Role

    Role.objects.filter(code="vfx-supervisor").update(is_system=False)

    output = _run()

    assert set(OLD_GRANTS) <= _codes("vfx-supervisor")
    assert "withdrawn" not in output


def test_a_withdrawn_code_is_never_in_that_roles_own_matrix():
    matrix = Command()._role_perm_matrix({spec[0]: object() for spec in PERMISSION_SPECS})

    for role_code, codes in WITHDRAWN_GRANTS.items():
        assert not set(codes) & set(matrix[role_code]), role_code


def test_every_withdrawn_code_is_in_the_catalog_and_names_a_seeded_role():
    catalog = {spec[0] for spec in PERMISSION_SPECS}
    seeded = {role["code"] for role in ROLE_SPECS}

    for role_code, codes in WITHDRAWN_GRANTS.items():
        assert role_code in seeded and set(codes) <= catalog
