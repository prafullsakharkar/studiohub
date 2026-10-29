"""``seed_dev`` partner data conforms to the Phase 5 rules and re-runs cleanly."""

from __future__ import annotations

import pytest
from django.db.models import Count

from apps.core.management.commands.seed_dev import Command
from apps.masterdata.models import (
    Client,
    ClientContact,
    ClientContract,
    Vendor,
    VendorContact,
    VendorContract,
)

pytestmark = pytest.mark.django_db


def seed():
    command = Command()
    command._seed_clients()
    command._seed_vendors()
    command._seed_contacts()
    command._seed_contracts()


def counts():
    return tuple(
        m.objects.count()
        for m in (Client, Vendor, ClientContact, VendorContact, ClientContract, VendorContract)
    )


def test_seeding_twice_changes_nothing():
    seed()
    first = counts()
    assert all(first)
    seed()
    assert counts() == first


def test_active_contracts_record_when_they_were_activated():
    seed()
    for model in (ClientContract, VendorContract):
        active = model.objects.filter(status="Active")
        assert active.exists()
        assert not active.filter(activated_at__isnull=True).exists()


def test_every_owner_has_at_most_one_primary_contact():
    seed()
    for model, owner in ((ClientContact, "client"), (VendorContact, "vendor")):
        crowded = (
            model.objects.filter(is_primary=True)
            .values(owner)
            .annotate(n=Count("pk"))
            .filter(n__gt=1)
        )
        assert not crowded.exists()


def test_the_seeded_billed_totals_are_the_canonical_figures():
    from apps.core.management.commands.seed_dev import CANONICAL_CLIENTS

    seed()
    expected = {c["code"]: c.get("total_billed_usd") for c in CANONICAL_CLIENTS}
    stored = {c.code: c.total_billed_usd for c in Client.objects.all()}
    assert {code: (int(v) if v is not None else None) for code, v in stored.items()} == expected
