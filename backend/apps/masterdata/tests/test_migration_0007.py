"""Migration 0007 (clients and vendors hardening): forward, backward, data handling, loud failures."""

from __future__ import annotations

import datetime

import pytest
from django.db import connection

from apps.masterdata.tests.migration_helpers import columns, constraints, migrate, migrate_to_latest

BEFORE = [("masterdata", "0006_software_on_lookup_base")]
AFTER = [("masterdata", "0007_clients_vendors_hardening")]

PAST = datetime.date(2020, 1, 1)
LATER = datetime.date(2020, 12, 31)


@pytest.fixture
def at_before():
    """Schema at 0006; always restored to the latest migration afterwards."""
    apps = migrate(BEFORE)
    try:
        yield apps
    finally:
        if "activated_at" not in columns("masterdata_client_contract"):
            for name in ("ClientContract", "VendorContract", "ClientContact", "VendorContact"):
                apps.get_model("masterdata", name).objects.all().delete()
            for name in ("Client", "Vendor"):
                apps.get_model("masterdata", name).objects.all().delete()
        migrate_to_latest()


def _client(apps, code="APEX", **kw):
    return apps.get_model("masterdata", "Client").objects.create(code=code, name=code, **kw)


def _vendor(apps, code="SRP", **kw):
    return apps.get_model("masterdata", "Vendor").objects.create(code=code, name=code, **kw)


def _contact(apps, client, **kw):
    kw.setdefault("name", "Jane")
    return apps.get_model("masterdata", "ClientContact").objects.create(client=client, **kw)


def _contract(apps, client, number="C-1", **kw):
    kw.setdefault("title", "T")
    kw.setdefault("type", "SOW")
    kw.setdefault("status", "Active")
    kw.setdefault("effective_date", PAST)
    return apps.get_model("masterdata", "ClientContract").objects.create(
        client=client, contract_number=number, **kw
    )


@pytest.mark.django_db(transaction=True)
class TestMigration0007:
    def test_reverses_and_reapplies_on_empty_tables(self, at_before):
        assert "activated_at" not in columns("masterdata_client_contract")
        assert "uq_masterdata_client_contract_number" in constraints("masterdata_client_contract")
        migrate(AFTER)
        assert {"activated_at", "currency"} <= columns("masterdata_client_contract")
        assert {"activated_at", "currency"} <= columns("masterdata_vendor_contract")
        assert "masterdata_clientcontract_uq_number_ci" in constraints("masterdata_client_contract")
        assert "masterdata_client_uq_code_ci" in constraints("masterdata_client")

    @pytest.mark.skipif(connection.vendor != "postgresql", reason="exclusion constraint")
    def test_the_overlap_constraint_exists_after_and_not_before(self, at_before):
        def has_exclusion():
            with connection.cursor() as cursor:
                cursor.execute("SELECT count(*) FROM pg_constraint WHERE contype = 'x'")
                return cursor.fetchone()[0]

        before = has_exclusion()
        migrate(AFTER)
        assert has_exclusion() == before + 2

    def test_data_survives_and_is_normalized(self, at_before):
        client = _client(at_before)
        contact = _contact(at_before, client, email="  Jane@Apex.VFX ")
        drafty = _contract(at_before, client, "C-1", status=" draft ")
        lived = _contract(at_before, client, "C-2", status="active")
        expired = _contract(at_before, client, "C-3", status="Expired", expiry_date=LATER)

        after = migrate(AFTER)

        Contact = after.get_model("masterdata", "ClientContact")
        Contract = after.get_model("masterdata", "ClientContract")
        assert Contact.objects.get(pk=contact.pk).email == "jane@apex.vfx"
        assert Contract.objects.get(pk=drafty.pk).status == "Draft"
        assert Contract.objects.get(pk=drafty.pk).activated_at is None
        assert Contract.objects.get(pk=lived.pk).status == "Active"
        assert Contract.objects.get(pk=lived.pk).activated_at is not None  # backfilled
        # A stored Expired with a past end date becomes Active; the API derives Expired.
        assert Contract.objects.get(pk=expired.pk).status == "Active"
        assert Contract.objects.get(pk=expired.pk).currency == "USD"
        assert Contract.objects.count() == 3

    def test_a_stored_expired_without_a_past_end_date_is_reported_not_guessed(self, at_before):
        _contract(at_before, _client(at_before), status="Expired", expiry_date=None)
        with pytest.raises(RuntimeError) as caught:
            migrate(AFTER)
        assert "status 'Expired' is not Draft, Active or Terminated" in str(caught.value)

    def test_an_existing_billed_total_is_left_untouched(self, at_before):
        row = _client(at_before, total_billed_usd=1250)
        after = migrate(AFTER)
        assert (
            after.get_model("masterdata", "Client").objects.get(pk=row.pk).total_billed_usd == 1250
        )

    def test_case_variant_duplicate_codes_stop_the_migration(self, at_before):
        _client(at_before, "Apex")
        _client(at_before, "APEX")
        with pytest.raises(RuntimeError) as caught:
            migrate(AFTER)
        message = str(caught.value)
        assert "masterdata 0007 cannot add its constraints" in message
        assert "Client: code 'apex' used by 2 rows" in message
        assert "activated_at" not in columns("masterdata_client_contract")  # rolled back

    def test_two_primary_contacts_stop_the_migration(self, at_before):
        client = _client(at_before)
        _contact(at_before, client, email="a@x.io", is_primary=True)
        _contact(at_before, client, email="b@x.io", is_primary=True)
        with pytest.raises(RuntimeError) as caught:
            migrate(AFTER)
        assert "2 primary contacts for client_id" in str(caught.value)

    def test_one_email_twice_for_an_owner_stops_the_migration(self, at_before):
        client = _client(at_before)
        _contact(at_before, client, email="a@x.io")
        _contact(at_before, client, email="A@X.io")
        with pytest.raises(RuntimeError) as caught:
            migrate(AFTER)
        assert "one e-mail used by 2 contacts" in str(caught.value)

    def test_case_variant_contract_numbers_stop_the_migration(self, at_before):
        client = _client(at_before)
        _contract(at_before, client, "MSA-1")
        _contract(at_before, client, "msa-1")
        with pytest.raises(RuntimeError) as caught:
            migrate(AFTER)
        assert "contract number 'msa-1' used 2 times" in str(caught.value)

    def test_an_active_contract_without_a_start_date_stops_the_migration(self, at_before):
        _contract(at_before, _client(at_before), effective_date=None)
        with pytest.raises(RuntimeError) as caught:
            migrate(AFTER)
        assert "Active without an effective_date" in str(caught.value)

    def test_an_inverted_date_range_stops_the_migration(self, at_before):
        _contract(at_before, _client(at_before), effective_date=LATER, expiry_date=PAST)
        with pytest.raises(RuntimeError) as caught:
            migrate(AFTER)
        assert "expiry_date is before effective_date" in str(caught.value)

    def test_overlapping_active_msas_stop_the_migration(self, at_before):
        client = _client(at_before)
        _contract(at_before, client, "A", type="MSA", effective_date=PAST, expiry_date=LATER)
        _contract(
            at_before,
            client,
            "B",
            type="MSA",
            effective_date=LATER,
            expiry_date=LATER + datetime.timedelta(days=5),
        )
        with pytest.raises(RuntimeError) as caught:
            migrate(AFTER)
        assert "MSAs" in str(caught.value) and "overlap" in str(caught.value)

    def test_overlapping_sows_and_other_owners_are_fine(self, at_before):
        a, b = _client(at_before, "A"), _client(at_before, "B")
        _contract(at_before, a, "S1", type="SOW", effective_date=PAST, expiry_date=LATER)
        _contract(at_before, a, "S2", type="SOW", effective_date=PAST, expiry_date=LATER)
        _contract(at_before, a, "M1", type="MSA", effective_date=PAST, expiry_date=LATER)
        _contract(at_before, b, "M1", type="MSA", effective_date=PAST, expiry_date=LATER)
        migrate(AFTER)

    def test_a_vendor_rating_outside_the_range_stops_the_migration(self, at_before):
        _vendor(at_before, rating=9)
        with pytest.raises(RuntimeError) as caught:
            migrate(AFTER)
        assert "outside 0 to 5" in str(caught.value)

    def test_soft_deleted_conflicts_do_not_block(self, at_before):
        _client(at_before, "Apex", is_deleted=True)
        _client(at_before, "APEX")
        migrate(AFTER)
