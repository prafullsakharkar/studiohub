"""Database-level guarantees for clients, vendors, contacts and contracts (CONTRACTS §4).

These bypass the services on purpose: the constraints are the backstop when a
writer (a script, a future code path, a race) does not go through them.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import IntegrityError, connection, transaction
from django.db.models import ProtectedError
from django.utils import timezone

from apps.masterdata.models import Client, ClientContract, VendorContract
from apps.masterdata.tests.factories import (
    ClientContactFactory,
    ClientContractFactory,
    ClientFactory,
    VendorContactFactory,
    VendorContractFactory,
    VendorFactory,
)

pytestmark = pytest.mark.django_db

postgres_only = pytest.mark.skipif(
    connection.vendor != "postgresql", reason="exclusion constraints exist on PostgreSQL only"
)
TODAY = timezone.localdate()


def day(offset):
    return TODAY + timedelta(days=offset)


def must_fail(fn):
    with pytest.raises(IntegrityError), transaction.atomic():
        fn()


class TestClientAndVendor:
    def test_code_is_unique_ignoring_case_among_live_rows(self):
        ClientFactory(code="apex")
        must_fail(lambda: ClientFactory(code="APEX"))

    def test_a_deleted_code_can_be_reused(self):
        ClientFactory(code="apex", is_deleted=True)
        assert ClientFactory(code="apex")

    def test_the_billed_total_is_not_negative(self):
        must_fail(lambda: ClientFactory(total_billed_usd=Decimal("-0.01")))
        assert ClientFactory(total_billed_usd=Decimal("0"))
        assert ClientFactory(total_billed_usd=None)

    @pytest.mark.parametrize("rating", [Decimal("-0.01"), Decimal("5.01")])
    def test_rating_is_between_zero_and_five(self, rating):
        must_fail(lambda: VendorFactory(rating=rating))

    @pytest.mark.parametrize("rating", [Decimal("0"), Decimal("5")])
    def test_rating_bounds_are_allowed(self, rating):
        assert VendorFactory(rating=rating)

    def test_vendor_code_is_unique_ignoring_case(self):
        VendorFactory(code="srp")
        must_fail(lambda: VendorFactory(code="SRP"))


class TestContacts:
    def test_one_primary_contact_per_client(self):
        client = ClientFactory()
        ClientContactFactory(client=client, is_primary=True)
        must_fail(lambda: ClientContactFactory(client=client, is_primary=True))
        assert ClientContactFactory(client=ClientFactory(), is_primary=True)
        assert ClientContactFactory(client=client, is_primary=False)

    def test_a_deleted_primary_does_not_count(self):
        client = ClientFactory()
        ClientContactFactory(client=client, is_primary=True, is_deleted=True)
        assert ClientContactFactory(client=client, is_primary=True)

    def test_one_primary_contact_per_vendor(self):
        vendor = VendorFactory()
        VendorContactFactory(vendor=vendor, is_primary=True)
        must_fail(lambda: VendorContactFactory(vendor=vendor, is_primary=True))

    def test_email_is_unique_per_owner_ignoring_case(self):
        client = ClientFactory()
        ClientContactFactory(client=client, email="a@x.io")
        must_fail(lambda: ClientContactFactory(client=client, email="A@X.IO"))
        assert ClientContactFactory(client=ClientFactory(), email="a@x.io")

    def test_blank_emails_do_not_collide(self):
        client = ClientFactory()
        ClientContactFactory(client=client, email="")
        assert ClientContactFactory(client=client, email="")

    def test_hard_deleting_an_owner_with_contacts_is_protected(self):
        contact = ClientContactFactory()
        with pytest.raises(ProtectedError):
            Client.all_objects.filter(pk=contact.client_id).delete()


class TestContracts:
    def test_contract_number_is_unique_per_owner_ignoring_case(self):
        client = ClientFactory()
        ClientContractFactory(client=client, contract_number="MSA-1")
        must_fail(lambda: ClientContractFactory(client=client, contract_number="msa-1"))
        assert ClientContractFactory(client=ClientFactory(), contract_number="MSA-1")

    def test_the_end_cannot_precede_the_start(self):
        must_fail(lambda: ClientContractFactory(effective_date=day(2), expiry_date=day(1)))
        assert ClientContractFactory(effective_date=day(2), expiry_date=day(2))

    def test_only_known_stored_statuses_are_allowed(self):
        must_fail(lambda: ClientContractFactory(status="Expired"))
        must_fail(lambda: VendorContractFactory(status="Whatever"))

    def test_an_active_contract_has_a_start_date(self):
        must_fail(lambda: ClientContractFactory(status="Active", effective_date=None))

    def test_a_terminated_contract_that_was_active_has_a_start_date(self):
        must_fail(
            lambda: ClientContractFactory(
                status="Terminated", activated_at=timezone.now(), effective_date=None
            )
        )
        assert ClientContractFactory(status="Terminated", activated_at=None, effective_date=None)


def _msa(factory, owner_field, owner, start, end, *, status="Active", activated=True, **kw):
    return factory(
        **{owner_field: owner},
        type=kw.pop("type", "MSA"),
        status=status,
        activated_at=timezone.now() if activated else None,
        effective_date=start,
        expiry_date=end,
        **kw,
    )


@postgres_only
@pytest.mark.parametrize(
    ("factory", "owner_factory", "owner_field"),
    [
        (ClientContractFactory, ClientFactory, "client"),
        (VendorContractFactory, VendorFactory, "vendor"),
    ],
    ids=["client", "vendor"],
)
class TestOverlapConstraint:
    def test_overlapping_active_msas_are_refused_even_without_the_service(
        self, factory, owner_factory, owner_field
    ):
        owner = owner_factory()
        _msa(factory, owner_field, owner, day(0), day(10))
        must_fail(lambda: _msa(factory, owner_field, owner, day(5), day(15)))

    def test_both_boundary_days_are_inclusive(self, factory, owner_factory, owner_field):
        owner = owner_factory()
        _msa(factory, owner_field, owner, day(0), day(10))
        must_fail(lambda: _msa(factory, owner_field, owner, day(10), day(20)))
        must_fail(lambda: _msa(factory, owner_field, owner, day(-5), day(0)))
        assert _msa(factory, owner_field, owner, day(11), day(20))

    def test_open_ended_means_to_infinity(self, factory, owner_factory, owner_field):
        owner = owner_factory()
        _msa(factory, owner_field, owner, day(0), None)
        must_fail(lambda: _msa(factory, owner_field, owner, day(1000), day(1001)))

    def test_sows_drafts_deleted_and_other_owners_are_unaffected(
        self, factory, owner_factory, owner_field
    ):
        owner = owner_factory()
        _msa(factory, owner_field, owner, day(0), day(10))
        assert _msa(factory, owner_field, owner, day(0), day(10), type="SOW")
        assert _msa(factory, owner_field, owner, day(0), day(10), status="Draft", activated=False)
        assert _msa(factory, owner_field, owner, day(0), day(10), is_deleted=True)
        assert _msa(factory, owner_field, owner_factory(), day(0), day(10))

    def test_a_terminated_msa_that_was_active_still_occupies_its_range(
        self, factory, owner_factory, owner_field
    ):
        owner = owner_factory()
        _msa(factory, owner_field, owner, day(0), day(10), status="Terminated")
        must_fail(lambda: _msa(factory, owner_field, owner, day(5), day(6)))

    def test_a_terminated_msa_that_never_started_occupies_nothing(
        self, factory, owner_factory, owner_field
    ):
        owner = owner_factory()
        _msa(factory, owner_field, owner, day(0), day(10), status="Terminated", activated=False)
        assert _msa(factory, owner_field, owner, day(5), day(6))

    def test_the_constraint_is_in_the_catalog(self, factory, owner_factory, owner_field):
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT count(*) FROM pg_constraint WHERE contype = 'x' AND conname LIKE %s",
                [f"masterdata_{factory._meta.model.__name__.lower()}_no_overlapping_active_msa"],
            )
            assert cursor.fetchone()[0] == 1


def test_the_models_are_the_ones_under_test():
    assert ClientContract._meta.get_field("value_usd") and VendorContract._meta.get_field(
        "total_value_usd"
    )
