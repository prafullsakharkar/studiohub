"""
Seeded role grants = enforced codes (docs/scheduling/PLAN.md section 6, decision Q34).

`init_platform` decides who holds which schedule code; the viewsets decide which code each action
needs. This pins the two together: every enforced code is in the catalog and held by some role, the
override code is held by nobody, and each role holds exactly what the plan says.
"""

from __future__ import annotations

import pytest

from apps.core.management.commands.init_platform import (
    OPT_IN_PERMISSION_CODES,
    PERMISSION_SPECS,
    ROLE_SPECS,
    Command,
)
from apps.scheduling.api import viewsets
from apps.scheduling.api.views import capacity
from apps.scheduling.constants.permissions import SchedulingPermissions

READ = {"schedule.view"}
OWN = READ | {"schedule.create"}
FULL = OWN | {
    "schedule.view_rates",
    "schedule.update",
    "schedule.delete",
    "schedule.manage",
    "schedule.approve",
}

#: docs/scheduling/PLAN.md section 6
EXPECTED = {
    "org-admin": FULL,
    "production-admin": FULL,
    "vfx-supervisor": FULL,
    "lead-artist": OWN,
    "artist": OWN,
    "org-member": set(),
}

OVERRIDES = {SchedulingPermissions.SOD_OVERRIDE}
#: checked inside the serializers rather than by a route (D-21): who sees pay rates
CHECKED_INLINE = {SchedulingPermissions.VIEW_RATES}


@pytest.fixture(scope="module")
def matrix():
    catalog = {spec[0]: object() for spec in PERMISSION_SPECS}
    return Command()._role_perm_matrix(catalog), set(catalog)


def _schedule(codes) -> set[str]:
    return {code for code in codes if code.startswith("schedule.")}


@pytest.mark.parametrize("role", sorted(EXPECTED))
def test_each_role_holds_exactly_its_schedule_codes(matrix, role):
    granted, _ = matrix

    assert _schedule(granted[role]) == EXPECTED[role]


def test_platform_admin_holds_every_schedule_code_except_the_override(matrix):
    granted, catalog = matrix

    assert _schedule(granted["platform-admin"]) == _schedule(catalog) - OVERRIDES


def test_the_override_is_in_the_catalog_opt_in_and_held_by_no_role(matrix):
    granted, catalog = matrix

    assert catalog >= OVERRIDES and OPT_IN_PERMISSION_CODES >= OVERRIDES
    assert all(not OVERRIDES & set(codes) for codes in granted.values())


def test_the_roles_nest_from_least_to_most_privilege():
    assert EXPECTED["artist"] <= EXPECTED["vfx-supervisor"]
    assert EXPECTED["lead-artist"] == EXPECTED["artist"]


def test_whoever_updated_can_still_manage_and_approve(matrix):
    """Q34: manage and approve went to the roles that held update, so nobody lost an ability."""
    granted, _ = matrix
    holders = lambda code: {  # noqa: E731
        role["code"] for role in ROLE_SPECS if code in granted[role["code"]]
    }

    assert holders("schedule.manage") == holders("schedule.update") | {"platform-admin"}
    assert holders("schedule.approve") == holders("schedule.update") | {"platform-admin"}
    assert holders("schedule.create") >= holders("schedule.update")


def _enforced() -> set[str]:
    codes: set[str] = set()
    for name in dir(viewsets):
        view = getattr(viewsets, name)
        if hasattr(view, "permission_map") and getattr(view, "__module__", "").startswith(
            "apps.scheduling"
        ):
            for perms in view.permission_map.values():
                codes |= set(perms)
    for view in (capacity.SchedulingCapacityView, capacity.SchedulingOverbookingView):
        codes |= {code for perms in getattr(view, "permission_map", {}).values() for code in perms}
    return codes


def test_every_enforced_code_is_in_the_catalog_and_held_by_some_role(matrix):
    granted, catalog = matrix
    held = {code for role in ROLE_SPECS for code in granted[role["code"]]}
    enforced = _enforced()

    assert enforced, "discovery found nothing"
    assert enforced - catalog == set()
    assert enforced - held == set(), "enforced but orphaned: no role holds it"


def test_every_code_the_constants_define_is_enforced_checked_inline_or_an_override():
    defined = {
        value
        for name, value in vars(SchedulingPermissions).items()
        if name.isupper() and isinstance(value, str)
    }

    assert defined - _enforced() == OVERRIDES | CHECKED_INLINE, (
        "a code is defined but nothing enforces it"
    )
    assert OVERRIDES & _enforced() == set()
