"""Races on PostgreSQL for contracts and contacts: exactly one winner, never a 500 (D8, CTR-05)."""

from __future__ import annotations

import threading
from datetime import timedelta
from typing import Any

import pytest
from django.db import connection
from django.utils import timezone
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.masterdata.constants.permissions import MasterdataPermissions as P
from apps.masterdata.models import ClientContact, ClientContract
from apps.masterdata.tests.factories import ClientContactFactory, ClientFactory

API = "/api/v1"
TODAY = timezone.localdate()

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


def _api(user) -> APIClient:
    api = APIClient(raise_request_exception=False)
    api.force_authenticate(user=user)
    return api


@pytest.fixture
def writer():
    user = UserFactory.create()
    grant_permissions(user, P.DIRECTORY_MANAGE, P.PERSON_VIEW_SENSITIVE)
    return user


def _msa(owner, number, start, end):
    return {
        "client": str(owner.pk),
        "contract_number": number,
        "title": "MSA",
        "type": "MSA",
        "status": "Active",
        "effective_date": str(TODAY + timedelta(days=start)),
        "expiry_date": str(TODAY + timedelta(days=end)),
    }


@pytest.mark.django_db(transaction=True)
class TestOverlappingContracts:
    def test_two_simultaneous_overlapping_msas_have_exactly_one_winner(self, writer):
        owner = ClientFactory()

        def create(number):
            return lambda: (
                _api(writer)
                .post(f"{API}/client-contracts/", _msa(owner, number, 0, 30), format="json")
                .status_code
            )

        statuses = _race(create("MSA-A"), create("MSA-B"))

        assert sorted(statuses) == [201, 409], statuses  # one wins, one is refused, no 500
        assert ClientContract.objects.filter(client=owner).count() == 1

    def test_the_loser_gets_the_specific_error_code(self, writer):
        owner = ClientFactory()

        def create(number):
            return lambda: _api(writer).post(
                f"{API}/client-contracts/", _msa(owner, number, 0, 30), format="json"
            )

        responses = _race(create("MSA-A"), create("MSA-B"))
        losers = [r for r in responses if r.status_code != 201]
        assert len(losers) == 1
        assert losers[0].json()["error"]["code"] == "contract_overlap"

    def test_non_overlapping_creates_both_succeed(self, writer):
        owner = ClientFactory()

        def create(number, start, end):
            return lambda: (
                _api(writer)
                .post(f"{API}/client-contracts/", _msa(owner, number, start, end), format="json")
                .status_code
            )

        assert _race(create("A", 0, 10), create("B", 11, 20)) == [201, 201]

    def test_concurrent_sows_are_not_serialized_out(self, writer):
        owner = ClientFactory()

        def create(number):
            body = {**_msa(owner, number, 0, 30), "type": "SOW"}
            return lambda: (
                _api(writer).post(f"{API}/client-contracts/", body, format="json").status_code
            )

        assert _race(create("S-A"), create("S-B"), create("S-C")) == [201, 201, 201]


@pytest.mark.django_db(transaction=True)
class TestPrimaryContact:
    def test_two_simultaneous_make_primary_calls_leave_exactly_one_primary(self, writer):
        owner = ClientFactory()
        first = ClientContactFactory(client=owner, is_primary=True)
        second = ClientContactFactory(client=owner)
        third = ClientContactFactory(client=owner)

        def promote(contact):
            return lambda: (
                _api(writer)
                .patch(f"{API}/client-contacts/{contact.pk}/", {"is_primary": True}, format="json")
                .status_code
            )

        statuses = _race(promote(second), promote(third))

        assert all(s in (200, 409) for s in statuses), statuses  # never a 500
        assert 200 in statuses
        assert ClientContact.objects.filter(client=owner, is_primary=True).count() == 1
        first.refresh_from_db()
        assert first.is_primary is False

    def test_two_simultaneous_creates_as_primary_leave_exactly_one(self, writer):
        owner = ClientFactory()

        def create(name):
            return lambda: (
                _api(writer)
                .post(
                    f"{API}/client-contacts/",
                    {"client": str(owner.pk), "name": name, "is_primary": True},
                    format="json",
                )
                .status_code
            )

        statuses = _race(create("A"), create("B"))

        assert all(s in (201, 409) for s in statuses), statuses
        assert 201 in statuses
        assert ClientContact.objects.filter(client=owner, is_primary=True).count() == 1
