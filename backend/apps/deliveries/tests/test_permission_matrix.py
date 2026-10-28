"""
Seeded role grants = enforced codes (docs/deliveries/PLAN.md section 6, decision Q34).

`init_platform` decides who holds which delivery code; the viewsets decide which code each action
needs. This pins the two together: every enforced code is in the catalog and held by some role,
the override codes are held by nobody, and each role holds exactly what the plan says.
"""

from __future__ import annotations

import pytest

from apps.core.management.commands.init_platform import (
    OPT_IN_PERMISSION_CODES,
    PERMISSION_SPECS,
    ROLE_SPECS,
    Command,
)
from apps.deliveries.api.viewsets.delivery import DeliveryViewSet
from apps.deliveries.api.viewsets.destination import DestinationViewSet
from apps.deliveries.constants.permissions import DeliveryPermissions

READ = {"delivery.view"}
WORK = READ | {"delivery.create", "delivery.update"}
SIGN = WORK | {"delivery.approve"}
SEND = SIGN | {"delivery.delete", "delivery.send", "delivery.view_secret"}

#: docs/deliveries/PLAN.md section 6
EXPECTED = {
    "org-admin": SEND,
    "production-admin": SEND,
    "vfx-supervisor": SIGN,
    "lead-artist": READ,
    "artist": READ,
    "org-member": set(),
}

OVERRIDES = {DeliveryPermissions.STATUS_OVERRIDE, DeliveryPermissions.SOD_OVERRIDE}


@pytest.fixture(scope="module")
def matrix():
    catalog = {spec[0]: object() for spec in PERMISSION_SPECS}
    return Command()._role_perm_matrix(catalog), set(catalog)


def _delivery(codes) -> set[str]:
    return {code for code in codes if code.startswith("delivery.")}


@pytest.mark.parametrize("role", sorted(EXPECTED))
def test_each_role_holds_exactly_its_delivery_codes(matrix, role):
    granted, _ = matrix

    assert _delivery(granted[role]) == EXPECTED[role]


def test_platform_admin_holds_every_delivery_code_except_the_overrides(matrix):
    granted, catalog = matrix

    assert _delivery(granted["platform-admin"]) == _delivery(catalog) - OVERRIDES


def test_the_override_codes_are_in_the_catalog_opt_in_and_held_by_no_role(matrix):
    granted, catalog = matrix

    assert catalog >= OVERRIDES and OPT_IN_PERMISSION_CODES >= OVERRIDES
    assert all(not OVERRIDES & set(codes) for codes in granted.values())


def test_the_roles_nest_from_least_to_most_privilege():
    assert EXPECTED["artist"] <= EXPECTED["vfx-supervisor"] <= EXPECTED["production-admin"]
    assert EXPECTED["lead-artist"] == EXPECTED["artist"]


def test_only_admins_send_and_read_the_passcode_and_supervisors_sign_off(matrix):
    granted, _ = matrix
    holders = lambda code: {  # noqa: E731
        role["code"] for role in ROLE_SPECS if code in granted[role["code"]]
    }

    assert holders("delivery.send") == {"platform-admin", "org-admin", "production-admin"}
    assert holders("delivery.view_secret") == {"platform-admin", "org-admin", "production-admin"}
    assert holders("delivery.approve") == {
        "platform-admin",
        "org-admin",
        "production-admin",
        "vfx-supervisor",
    }
    assert holders("delivery.delete") == {"platform-admin", "org-admin", "production-admin"}


def _enforced() -> set[str]:
    codes: set[str] = set()
    for viewset in (DeliveryViewSet, DestinationViewSet):
        for perms in viewset.permission_map.values():
            codes |= set(perms)
    return codes


def test_every_enforced_code_is_in_the_catalog_and_held_by_some_role(matrix):
    granted, catalog = matrix
    held = {code for role in ROLE_SPECS for code in granted[role["code"]]}
    enforced = _enforced()

    assert enforced, "discovery found nothing"
    assert enforced - catalog == set()
    assert enforced - held == set(), "enforced but orphaned: no role holds it"


def test_every_code_the_constants_define_is_enforced_or_an_override():
    defined = {
        value
        for name, value in vars(DeliveryPermissions).items()
        if name.isupper() and isinstance(value, str)
    }

    assert defined - _enforced() == OVERRIDES, "a code is defined but nothing enforces it"
    assert OVERRIDES & _enforced() == set()
