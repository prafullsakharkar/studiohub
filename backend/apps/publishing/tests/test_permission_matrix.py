"""
The publishing codes and who holds them (docs/delivery-pipeline Q34): every code the API enforces
is granted to a role, the override is granted to none, and each seeded role holds exactly its set.
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
from apps.publishing.constants.permissions import PublishPermissions as P

pytestmark = pytest.mark.django_db

PUBLISHING_CODES = {
    value for name, value in vars(P).items() if name.isupper() and isinstance(value, str)
}

EXPECTED = {
    "platform-admin": PUBLISHING_CODES - {P.STATUS_OVERRIDE},
    "org-admin": {P.VIEW, P.CREATE, P.UPDATE, P.DELETE, P.DEPRECATE, P.REVOKE, P.STORAGE_MANAGE},
    "production-admin": {P.VIEW, P.CREATE, P.UPDATE, P.DELETE, P.DEPRECATE, P.REVOKE},
    # No delete: removing export job records is an admin task.
    "vfx-supervisor": {P.VIEW, P.CREATE, P.UPDATE, P.DEPRECATE, P.REVOKE},
    # A lead registers the files of their own published versions.
    "lead-artist": {P.VIEW, P.CREATE},
    "artist": {P.VIEW},
    "org-member": set(),
}


@pytest.fixture(scope="module")
def matrix():
    catalog = {spec[0]: object() for spec in PERMISSION_SPECS}
    return Command()._role_perm_matrix(catalog), set(catalog)


def _publishing(codes) -> set[str]:
    return {code for code in codes if code in PUBLISHING_CODES}


@pytest.mark.parametrize("role", sorted(EXPECTED))
def test_each_role_holds_exactly_its_publishing_codes(matrix, role):
    granted, _ = matrix

    assert _publishing(granted[role]) == EXPECTED[role]


def test_every_role_in_the_seed_is_covered_by_this_table():
    assert {role["code"] for role in ROLE_SPECS} == set(EXPECTED)


def test_the_override_is_in_the_catalog_and_held_by_no_role(matrix):
    granted, catalog = matrix

    assert P.STATUS_OVERRIDE in catalog and P.STATUS_OVERRIDE in OPT_IN_PERMISSION_CODES
    assert all(P.STATUS_OVERRIDE not in codes for codes in granted.values())


def test_every_constant_is_in_the_catalog(matrix):
    _, catalog = matrix

    assert catalog >= PUBLISHING_CODES


def _enforced() -> set[str]:
    """Every code named in a permission_map under apps.publishing.api.viewsets."""
    viewsets = importlib.import_module("apps.publishing.api.viewsets")

    codes: set[str] = set()
    for info in pkgutil.iter_modules(viewsets.__path__):
        module = importlib.import_module(f"{viewsets.__name__}.{info.name}")
        for obj in vars(module).values():
            if isinstance(obj, type) and obj.__module__ == module.__name__:
                for perms in getattr(obj, "permission_map", {}).values():
                    codes |= set(perms)
    return codes


def test_every_enforced_code_is_granted_to_some_role(matrix):
    granted, catalog = matrix
    held = {code for role in ROLE_SPECS for code in granted[role["code"]]}
    enforced = _enforced()

    assert enforced, "discovery found nothing"
    assert enforced <= catalog, "enforced but not in the catalog"
    assert enforced <= held, "enforced but orphaned: no role holds it"


def test_every_seeded_code_is_enforced_or_checked_inline(matrix):
    """No code is granted that nothing looks at: the override is the one checked inline."""
    assert PUBLISHING_CODES - _enforced() == {P.STATUS_OVERRIDE}
