"""
The production role-to-code matrix (docs/production/DECISIONS.md D-07).

Each seeded role's exact set of production codes is written out here, so widening
a role is a deliberate edit of this file. A second group of tests proves that no
code the API enforces is orphaned (granted to no role) and that the opt-in
override codes are granted to nobody.
"""

from __future__ import annotations

import importlib
import pkgutil

import pytest

from apps.core.management.commands.init_platform import (
    OPT_IN_PERMISSION_CODES,
    PERMISSION_SPECS,
    ROLE_SPECS,
    Command,
)

#: resources the production API enforces (plus the two single codes below)
PRODUCTION_PREFIXES = {
    "project",
    "sequence",
    "episode",
    "shot",
    "asset",
    "task",
    "timelog",
    "version",
    "review",
    "playlist",
    "media",
    "workflow",
    "schedule",
    "track",
    "show",
    "automation",
    "delivery",
    "publishing",
    "note",
    "audit",
    "production",
}

ALL_ACTIONS = "view create update delete"

FULL = {
    "project": ALL_ACTIONS,
    "sequence": ALL_ACTIONS,
    "episode": ALL_ACTIONS,
    "shot": f"{ALL_ACTIONS} approve",
    "asset": ALL_ACTIONS,
    "task": ALL_ACTIONS,
    "timelog": f"{ALL_ACTIONS} view_all approve manage",
    "version": f"{ALL_ACTIONS} publish",
    "review": f"{ALL_ACTIONS} approve",
    "playlist": ALL_ACTIONS,
    "media": ALL_ACTIONS,
    "workflow": ALL_ACTIONS,
    "schedule": ALL_ACTIONS,
    "track": ALL_ACTIONS,
    "show": ALL_ACTIONS,
    "automation": ALL_ACTIONS,
    "delivery": ALL_ACTIONS,
    "publishing": ALL_ACTIONS,
    "note": "create",
    "audit": "view",
}
LEAD = {
    "project": "view",
    "sequence": "view",
    "episode": "view",
    "shot": "view update approve",
    "asset": "view create update",
    "task": "view create update",
    "timelog": "view view_all create update approve",
    "version": "view create update publish",
    "review": "view create update",
    "playlist": "view create update",
    "media": "view create update",
    "workflow": "view",
    "schedule": "view",
    "track": "view",
    "show": "view",
    "delivery": "view",
    "publishing": "view",
    "note": "create",
    "audit": "view",
}
ARTIST = {
    "project": "view",
    "sequence": "view",
    "episode": "view",
    "shot": "view",
    "asset": "view",
    "task": "view update",
    "timelog": "view create update",
    "version": "view create",
    "review": "view",
    "playlist": "view",
    "media": "view create",
    "workflow": "view",
    "schedule": "view",
    "track": "view",
    "show": "view",
    "delivery": "view",
    "publishing": "view",
    "note": "create",
}


def _codes(table: dict[str, str]) -> set[str]:
    return {
        f"{resource}.{action}" for resource, actions in table.items() for action in actions.split()
    }


EXPECTED = {
    # The code freeze on shots and assets is lifted by production-admin only.
    "production-admin": _codes(FULL) | {"production.code.rename"},
    "vfx-supervisor": _codes(FULL),
    "org-admin": _codes(FULL),
    "lead-artist": _codes(LEAD),
    "artist": _codes(ARTIST),
    "org-member": set(),
}


def _production(codes) -> set[str]:
    return {code for code in codes if code.split(".")[0] in PRODUCTION_PREFIXES}


@pytest.fixture(scope="module")
def matrix():
    catalog = {spec[0]: object() for spec in PERMISSION_SPECS}
    return Command()._role_perm_matrix(catalog), set(catalog)


@pytest.mark.parametrize("role", sorted(EXPECTED))
def test_each_role_holds_exactly_its_production_codes(matrix, role):
    granted, _ = matrix

    assert _production(granted[role]) == EXPECTED[role]


def test_platform_admin_holds_the_whole_catalog_except_the_opt_in_codes(matrix):
    granted, catalog = matrix

    assert set(granted["platform-admin"]) == catalog - OPT_IN_PERMISSION_CODES


def test_lead_and_artist_are_least_privilege_subsets_of_the_full_role():
    assert EXPECTED["artist"] <= EXPECTED["lead-artist"] <= EXPECTED["vfx-supervisor"]
    assert not {code for code in EXPECTED["lead-artist"] if code.endswith(".delete")}
    assert not {
        code
        for code in EXPECTED["artist"]
        if code.split(".")[1] in {"approve", "publish", "manage", "view_all"}
    }


def test_only_roles_that_decide_about_time_see_everyones_timelogs():
    holders = {role for role, codes in EXPECTED.items() if "timelog.view_all" in codes}

    assert holders == {"production-admin", "vfx-supervisor", "org-admin", "lead-artist"}
    assert "timelog.view" in EXPECTED["artist"] and "timelog.view_all" not in EXPECTED["artist"]


def test_only_full_roles_can_log_time_for_others():
    assert {role for role, codes in EXPECTED.items() if "timelog.manage" in codes} == {
        "production-admin",
        "vfx-supervisor",
        "org-admin",
    }


# -- no orphaned codes ---------------------------------------------------------


def _enforced_codes() -> set[str]:
    """Every permission code a production viewset or view enforces, found by importing them."""
    from apps.production.constants import workflow

    codes: set[str] = set()
    for package in ("apps.production.api.viewsets", "apps.production.api.views"):
        module = importlib.import_module(package)
        for info in pkgutil.iter_modules(module.__path__):
            loaded = importlib.import_module(f"{package}.{info.name}")
            for obj in vars(loaded).values():
                if isinstance(obj, type) and obj.__module__ == loaded.__name__:
                    for perms in getattr(obj, "permission_map", {}).values():
                        codes |= set(perms)
    for table in (workflow.ENTERING, workflow.LEAVING):
        for per_status in table.values():
            codes |= set(per_status.values())
    return codes


def test_every_enforced_code_is_in_the_catalog_and_granted_to_some_role(matrix):
    granted, catalog = matrix
    held_by_a_role = {code for role in ROLE_SPECS for code in granted[role["code"]]}
    enforced = _enforced_codes()

    assert enforced, "discovery found nothing"
    assert enforced - catalog == set(), "enforced but not in the catalog"
    assert enforced - held_by_a_role == set(), "enforced but orphaned: no role holds it"


def test_every_code_the_production_constants_define_is_enforced_or_deliberately_not():
    from apps.production.constants import permissions as constants

    defined = {
        value
        for obj in vars(constants).values()
        if isinstance(obj, type) and obj.__module__ == constants.__name__
        for name, value in vars(obj).items()
        if name.isupper() and isinstance(value, str)
    }
    # Checked in code rather than through a permission_map.
    checked_inline = {"timelog.manage", "timelog.view_all"} | set(OPT_IN_PERMISSION_CODES)
    # Declared, but the analytics views are scoped by membership only (CONTRACTS C-04).
    # schedule.create/delete are checked by the scheduling app's own viewsets, not by production.
    not_enforced = {"analytics.view", "schedule.create", "schedule.delete"}

    assert defined - _enforced_codes() - checked_inline - not_enforced == set()
    assert checked_inline <= defined | set(OPT_IN_PERMISSION_CODES)


def test_the_opt_in_codes_are_in_the_catalog_and_held_by_no_role(matrix):
    granted, catalog = matrix

    assert catalog >= OPT_IN_PERMISSION_CODES
    assert all(not OPT_IN_PERMISSION_CODES & set(codes) for codes in granted.values())
