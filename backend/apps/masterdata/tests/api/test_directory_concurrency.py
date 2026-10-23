"""Races on PostgreSQL for the organizational models: one winner, never a 500."""

from __future__ import annotations

import threading
from typing import Any

import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.masterdata.constants.permissions import MasterdataPermissions as P
from apps.masterdata.models import Department, Office, Person
from apps.masterdata.tests.factories import DepartmentFactory, OfficeFactory, PersonFactory

API = "/api/v1"

pytestmark = pytest.mark.skipif(
    connection.vendor != "postgresql", reason="needs real concurrent transactions"
)


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


@pytest.fixture
def writer():
    user = UserFactory.create()
    grant_permissions(user, P.DIRECTORY_MANAGE)
    return user


def _api(user) -> APIClient:
    api = APIClient(raise_request_exception=False)
    api.force_authenticate(user=user)
    return api


@pytest.mark.django_db(transaction=True)
class TestHierarchyRace:
    def test_two_moves_that_would_form_a_cycle_have_one_winner(self, writer):
        a, b = DepartmentFactory(), DepartmentFactory()

        def move(node, target):
            return lambda: (
                _api(writer)
                .patch(f"{API}/departments/{node.pk}/", {"parent": str(target.pk)}, format="json")
                .status_code
            )

        statuses = _race(move(a, b), move(b, a))

        assert sorted(statuses) == [200, 400], statuses
        a.refresh_from_db()
        b.refresh_from_db()
        # No cycle: exactly one of them is the other's parent.
        assert (a.parent_id == b.pk) != (b.parent_id == a.pk)
        assert Department.objects.filter(parent__isnull=True).count() == 1


@pytest.mark.django_db(transaction=True)
class TestHeadquartersRace:
    def test_two_simultaneous_new_headquarters_leave_exactly_one(self, writer):
        OfficeFactory(is_headquarters=True)

        def make(code):
            body = {
                "code": code,
                "name": code,
                "office_type": "studio",
                "timezone": "Europe/London",
                "country": "UK",
                "city": "London",
                "is_headquarters": True,
            }
            return lambda: _api(writer).post(f"{API}/offices/", body, format="json").status_code

        statuses = _race(make("A"), make("B"))

        assert all(s in (201, 409) for s in statuses), statuses  # never a 500
        assert 201 in statuses
        assert Office.objects.filter(is_headquarters=True).count() == 1


@pytest.mark.django_db(transaction=True)
class TestLinkRace:
    def test_one_user_linked_to_two_people_at_once_has_one_winner(self, writer):
        user = UserFactory.create(email="shared@example.com")
        first, second = PersonFactory(), PersonFactory()

        def link(person):
            return lambda: (
                _api(writer)
                .post(f"{API}/people/{person.pk}/link-user/", {"user": str(user.pk)})
                .status_code
            )

        statuses = _race(link(first), link(second))

        assert sorted(statuses) == [200, 409], statuses
        assert Person.objects.filter(user=user).count() == 1
