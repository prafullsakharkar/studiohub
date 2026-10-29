"""The legacy ``platform.master_data.*`` codes grant nothing (DECISIONS D9, Phase 8).

They were an alias for the masterdata manage codes while the frontend and the seed moved to
the new ones. Now a holder of only an old code is refused on every write, and ``init_platform``
removes the old codes and every grant of them.
"""

from __future__ import annotations

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.identity.models import Permission, Role, RolePermission
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.masterdata.tests.factories import (
    ClientFactory,
    DepartmentFactory,
    MasterTaskTypeFactory,
    OfficeFactory,
    PersonFactory,
    PositionFactory,
    SoftwareFactory,
    TeamFactory,
    VendorFactory,
)

pytestmark = pytest.mark.django_db

LEGACY = ("platform.master_data.configure", "platform.master_data.create")
API = "/api/v1"
CATALOG = f"{API}/platform/master-data"

#: (collection url, factory, a payload that would be valid for a holder of the right code)
RESOURCES = [
    (f"{CATALOG}/task-types", MasterTaskTypeFactory, {"code": "anim", "name": "Animation"}),
    (f"{CATALOG}/software", SoftwareFactory, {"code": "maya", "name": "Maya"}),
    (
        f"{API}/departments/",
        DepartmentFactory,
        {"code": "D", "name": "D", "department_type": "creative"},
    ),
    (f"{API}/teams/", TeamFactory, {"code": "T", "name": "T"}),
    (f"{API}/offices/", OfficeFactory, {"code": "O", "name": "O"}),
    (f"{API}/positions/", PositionFactory, {"code": "P", "name": "P"}),
    (f"{API}/people/", PersonFactory, {"name": "Someone"}),
    (f"{API}/clients/", ClientFactory, {"code": "C", "name": "C"}),
    (f"{API}/vendors/", VendorFactory, {"code": "V", "name": "V"}),
]
IDS = [
    r[0].rsplit("/", 2)[-2] if r[0].endswith("/") else r[0].rsplit("/", 1)[-1] for r in RESOURCES
]


def legacy_client(*codes: str) -> APIClient:
    user = UserFactory.create()
    grant_permissions(user, *(codes or LEGACY))
    api = APIClient(raise_request_exception=False)
    api.force_authenticate(user=user)
    return api


@pytest.mark.parametrize(("url", "factory", "payload"), RESOURCES, ids=IDS)
class TestHolderOfOnlyAnOldCodeIsRefused:
    def test_create(self, url, factory, payload):
        assert legacy_client().post(url, payload, format="json").status_code == 403

    def test_update_delete_and_restore(self, url, factory, payload):
        row = factory()
        detail = f"{url.rstrip('/')}/{row.pk}" + ("/" if url.endswith("/") else "")
        api = legacy_client()
        assert api.patch(detail, {"name": "x"}, format="json").status_code == 403
        assert api.delete(detail).status_code == 403
        restore = f"{detail.rstrip('/')}/restore" + ("/" if url.endswith("/") else "")
        assert api.post(restore).status_code == 403

    def test_hard_delete(self, url, factory, payload):
        row = factory(is_deleted=True)
        detail = f"{url.rstrip('/')}/{row.pk}" + ("/" if url.endswith("/") else "")
        assert legacy_client().delete(f"{detail}?hard=true").status_code == 403

    def test_reads_stay_open(self, url, factory, payload):
        factory()
        assert legacy_client().get(url).status_code == 200


@pytest.mark.usefixtures("seeded_platform_class")
class TestFromAFreshSeed:
    """Tests that start from the first ``init_platform`` run, shared across the class (conftest.py)."""

    def test_old_codes_are_not_in_the_permission_catalog_or_any_role_after_the_seed(self):
        assert not Permission.objects.filter(code__in=LEGACY).exists()
        assert not RolePermission.objects.filter(permission__code__in=LEGACY).exists()

    def test_the_seed_removes_old_codes_and_grants_left_in_an_existing_database(self):
        role = Role.objects.get(code="org-admin")
        legacy = [
            Permission.objects.create(
                code=c, name=c, module="master_data", action=c.rsplit(".", 1)[-1]
            )
            for c in LEGACY
        ]
        for permission in legacy:
            RolePermission.objects.create(role=role, permission=permission, granted=True)
        holder = UserFactory.create()
        grant_permissions(holder, *LEGACY)

        call_command("init_platform")

        assert not Permission.all_objects.filter(code__in=LEGACY).exists()
        assert not RolePermission.all_objects.filter(permission__code__in=LEGACY).exists()
        # The holder's access is gone too (cache invalidated), not just the rows.
        api = APIClient(raise_request_exception=False)
        api.force_authenticate(user=holder)
        assert (
            api.post(f"{API}/clients/", {"code": "X", "name": "X"}, format="json").status_code
            == 403
        )

    def test_running_the_seed_again_removes_nothing_more(self):
        before = Permission.objects.count(), RolePermission.objects.count()
        call_command("init_platform")
        assert (Permission.objects.count(), RolePermission.objects.count()) == before


def test_the_old_code_never_combines_with_a_new_one():
    """Holding an old code next to the right new code adds and removes nothing."""
    from apps.masterdata.constants.permissions import MasterdataPermissions as P

    both = legacy_client(*LEGACY, P.DIRECTORY_MANAGE)
    only_new = legacy_client(P.DIRECTORY_MANAGE)
    for api, code in ((both, "B"), (only_new, "N")):
        assert (
            api.post(f"{API}/clients/", {"code": code, "name": code}, format="json").status_code
            == 201
        )
    # ...and neither can write catalogs: DIRECTORY_MANAGE is not the catalog code.
    for api in (both, only_new):
        assert (
            api.post(f"{CATALOG}/task-types", {"code": "x", "name": "X"}, format="json").status_code
            == 403
        )
