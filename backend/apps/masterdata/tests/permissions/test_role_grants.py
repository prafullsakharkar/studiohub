"""What each seeded role holds for masterdata after ``init_platform`` (DECISIONS D9, D11).

Org-admin is Option B (transitional, follow-up FU-1): the new manage codes are held
explicitly, nothing more. These tests pin the exact sets so a change is a visible,
reviewed edit and not a side effect.
"""

from __future__ import annotations

import pytest
from django.core.management import call_command

from apps.identity.models import Role, RolePermission

pytestmark = pytest.mark.django_db

MASTERDATA_PREFIXES = ("masterdata.", "platform.master_data.")


@pytest.fixture(autouse=True)
def seeded():
    call_command("init_platform")


def granted(role_code: str) -> set[str]:
    role = Role.objects.get(code=role_code)
    return set(
        RolePermission.objects.filter(role=role, granted=True).values_list(
            "permission__code", flat=True
        )
    )


def masterdata_part(role_code: str) -> set[str]:
    return {c for c in granted(role_code) if c.startswith(MASTERDATA_PREFIXES)}


def test_org_admin_holds_exactly_this_set_of_masterdata_permissions():
    assert masterdata_part("org-admin") == {
        "masterdata.directory.manage",
        "masterdata.catalog.manage",
        "masterdata.person.view_sensitive",
        "masterdata.client.view_financial",
    }


def test_org_admin_holds_exactly_this_set_overall():
    non_production = {c for c in granted("org-admin") if c.split(".")[0] not in PRODUCTION_AREAS}
    assert non_production == {
        "masterdata.directory.manage",
        "masterdata.catalog.manage",
        "masterdata.person.view_sensitive",
        "masterdata.client.view_financial",
        "identity.user.view",
        "settings.manage",
        "settings.update",
        "user.manage",
    }


PRODUCTION_AREAS = {
    "project",
    "shot",
    "asset",
    "task",
    "review",
    "delivery",
    "publishing",
    "schedule",
    "track",
    "show",
    "automation",
    "note",
    "sequence",
    "version",
    "media",
    "timelog",
    "episode",
    "playlist",
    "workflow",
    "audit",
}


def test_only_platform_admin_can_hard_delete():
    holders = {
        role.code for role in Role.objects.all() if "masterdata.hard_delete" in granted(role.code)
    }
    assert holders <= {"platform-admin"}


def test_platform_admin_holds_every_masterdata_permission():
    assert {
        "masterdata.hard_delete",
        "masterdata.catalog.manage",
        "masterdata.directory.manage",
        "masterdata.person.view_sensitive",
        "masterdata.client.view_financial",
    } <= granted("platform-admin")


def test_production_admin_sees_financial_values_but_not_personal_data():
    held = masterdata_part("production-admin")
    assert held == {"masterdata.client.view_financial"}


@pytest.mark.parametrize("role", ["vfx-supervisor", "lead-artist", "artist", "org-member"])
def test_other_roles_hold_no_masterdata_write_or_gated_read(role):
    gated = {
        "masterdata.client.view_financial",
        "masterdata.person.view_sensitive",
        "masterdata.directory.manage",
        "masterdata.catalog.manage",
        "masterdata.hard_delete",
        "platform.master_data.configure",
        "platform.master_data.create",
    }
    assert not gated & granted(role), sorted(gated & granted(role))


def test_the_seed_is_idempotent_for_role_grants():
    before = {r.code: granted(r.code) for r in Role.objects.all()}
    call_command("init_platform")
    assert {r.code: granted(r.code) for r in Role.objects.all()} == before
