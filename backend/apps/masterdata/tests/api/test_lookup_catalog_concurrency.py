"""Races on PostgreSQL: exactly one winner, never a 500 (CONTRACTS §3.1)."""

from __future__ import annotations

import threading
from typing import Any

import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.masterdata.constants.permissions import MasterdataPermissions
from apps.masterdata.models import MasterStatus, MasterTaskType

BASE = "/api/v1/platform/master-data"


def _race(*callables):
    barrier = threading.Barrier(len(callables))
    results: list[Any] = [None] * len(callables)

    def runner(index, fn):
        try:
            barrier.wait(timeout=10)
            results[index] = fn()
        except Exception as exc:  # noqa: BLE001 - the test inspects it
            results[index] = exc
        finally:
            connection.close()

    threads = [threading.Thread(target=runner, args=(i, fn)) for i, fn in enumerate(callables)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)
    return results


def _manager_client(user) -> APIClient:
    client = APIClient(raise_request_exception=False)
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def manager_user():
    user = UserFactory.create()
    grant_permissions(user, MasterdataPermissions.CATALOG_MANAGE)
    return user


@pytest.mark.django_db(transaction=True)
class TestConcurrentCreate:
    def test_the_same_code_created_twice_at_once_has_one_winner(self, manager_user):
        payload = {"code": "anim", "name": "Animation"}

        def create():
            return (
                _manager_client(manager_user)
                .post(f"{BASE}/task-types", payload, format="json")
                .status_code
            )

        statuses = _race(create, create)

        assert 201 in statuses, statuses
        assert all(s in (201, 400, 409) for s in statuses), statuses  # never a 500
        losers = [s for s in statuses if s != 201]
        assert len(losers) == 1 and losers[0] in (400, 409), statuses  # a clean 4xx
        assert MasterTaskType.objects.filter(code="anim").count() == 1

    def test_same_code_differing_only_in_case_has_one_winner(self, manager_user):
        def create(code):
            return lambda: (
                _manager_client(manager_user)
                .post(f"{BASE}/asset-types", {"code": code, "name": f"Name {code}"}, format="json")
                .status_code
            )

        statuses = _race(create("Prop"), create("PROP"))

        assert all(s in (201, 400, 409) for s in statuses), statuses
        assert statuses.count(201) == 1

    def test_two_new_defaults_at_once_leave_exactly_one_default(self, manager_user):
        def create(code):
            return lambda: (
                _manager_client(manager_user)
                .post(
                    f"{BASE}/statuses",
                    {
                        "entity_type": "Asset",
                        "code": code,
                        "name": code.upper(),
                        "is_default": True,
                    },
                    format="json",
                )
                .status_code
            )

        statuses = _race(create("a"), create("b"))

        assert all(s in (201, 409) for s in statuses), statuses  # never a 500
        assert 201 in statuses
        assert MasterStatus.objects.filter(entity_type="Asset", is_default=True).count() == 1

    def test_two_concurrent_soft_deletes_both_end_deleted(self, manager_user):
        from apps.masterdata.tests.factories import MasterTaskTypeFactory

        row = MasterTaskTypeFactory()

        def delete():
            return _manager_client(manager_user).delete(f"{BASE}/task-types/{row.pk}").status_code

        statuses = _race(delete, delete)

        assert all(s in (200, 404) for s in statuses), statuses
        assert MasterTaskType.all_objects.get(pk=row.pk).is_deleted is True


@pytest.mark.django_db(transaction=True)
class TestConcurrentSoftware:
    def test_the_same_version_created_twice_at_once_has_one_winner(self, manager_user):
        from apps.masterdata.models import SoftwareVersion
        from apps.masterdata.tests.factories import SoftwareFactory

        software = SoftwareFactory()

        def create(version):
            return lambda: (
                _manager_client(manager_user)
                .post(
                    f"{BASE}/software/{software.pk}/versions", {"version": version}, format="json"
                )
                .status_code
            )

        statuses = _race(create("2025A"), create("2025a"))  # differ only by case

        assert all(s in (201, 400, 409) for s in statuses), statuses  # never a 500
        assert statuses.count(201) == 1, statuses
        assert SoftwareVersion.objects.filter(software=software).count() == 1

    def test_the_same_software_code_created_twice_at_once_has_one_winner(self, manager_user):
        from apps.masterdata.models import Software

        def create(name):
            return lambda: (
                _manager_client(manager_user)
                .post(f"{BASE}/software", {"code": "maya", "name": name}, format="json")
                .status_code
            )

        statuses = _race(create("Maya"), create("Maya 2"))

        assert all(s in (201, 400, 409) for s in statuses), statuses
        assert statuses.count(201) == 1, statuses
        assert Software.objects.filter(code="maya").count() == 1

    def test_deleting_a_software_while_a_version_is_created_leaves_no_orphan(self, manager_user):
        """A version created at the same instant is either deleted with its software or refused."""
        from apps.masterdata.models import SoftwareVersion
        from apps.masterdata.tests.factories import SoftwareFactory

        software = SoftwareFactory()

        def delete():
            return (
                _manager_client(manager_user).delete(f"{BASE}/software/{software.pk}").status_code
            )

        def create():
            return (
                _manager_client(manager_user)
                .post(f"{BASE}/software/{software.pk}/versions", {"version": "1"}, format="json")
                .status_code
            )

        statuses = _race(delete, create)

        assert all(s < 500 for s in statuses), statuses
        live_versions = SoftwareVersion.objects.filter(software=software).count()
        # Whatever the order, a live version never survives under a deleted software.
        assert live_versions == 0
