"""Personal and financial values never reach the ChangeLog (H4 / D13)."""

from __future__ import annotations

from decimal import Decimal

import pytest

from apps.audit.models import ChangeLog
from apps.masterdata.models import Client, Person, Position, Vendor
from apps.masterdata.tests.factories import ClientFactory, VendorFactory

pytestmark = pytest.mark.django_db

SECRETS = ("jane.doe.4417@example.com", "+1-555-0100-4417", "Tanaka-Okonkwo-4417", "987654.32")


def _dump() -> str:
    return " ".join(
        str([r.before_values, r.after_values, r.changed_fields, r.target_name, r.description])
        for r in ChangeLog.objects.all()
    )


def _assert_clean():
    text = _dump()
    assert text.strip(), "nothing was recorded, the test proves nothing"
    leaked = [s for s in SECRETS if s in text]
    assert not leaked, f"{leaked} reached the ChangeLog"


def test_a_person_is_logged_without_personal_data():
    person = Person.objects.create(
        name="Tanaka-Okonkwo-4417", email=SECRETS[0], phone=SECRETS[1], nationality="JP"
    )
    person.email = "other.4417@example.com"
    person.save()
    # Changing only a personal field leaves nothing to record.
    assert ChangeLog.objects.filter(target_type="Person").count() == 1
    person.description = "Compositor"
    person.save()
    rows = ChangeLog.objects.filter(target_type="Person")
    assert rows.count() == 2
    assert rows.order_by("created_at").last().changed_fields == ["description"]  # pyright: ignore[reportOptionalMemberAccess]
    _assert_clean()
    assert "other.4417" not in _dump()
    assert all(r.target_id == str(person.pk) for r in rows)  # still identifiable


def test_a_client_is_logged_without_contact_data_or_the_billed_total():
    client = ClientFactory(
        contact_name="Tanaka-Okonkwo-4417",
        email=SECRETS[0],
        phone=SECRETS[1],
        total_billed_usd=Decimal("987654.32"),
    )
    client.total_billed_usd = Decimal("1.00")
    client.name = "Renamed"
    client.save()
    _assert_clean()
    update = ChangeLog.objects.filter(target_type="Client").order_by("created_at").last()
    assert update is not None and update.changed_fields == ["name"]


def test_a_vendor_is_logged_without_contact_data():
    VendorFactory(contact_name="Tanaka-Okonkwo-4417", email=SECRETS[0])
    _assert_clean()


def test_ordinary_fields_are_still_tracked():
    client = ClientFactory(name="Before")
    client.name = "After"
    client.save()
    row = ChangeLog.objects.filter(target_type="Client").order_by("created_at").last()
    assert row is not None
    assert row.before_values["name"] == "Before" and row.after_values["name"] == "After"
    assert row.target_name == "After"  # a company name is not personal data


def test_the_exclusion_lists_name_real_fields():
    for model in (Client, Vendor, Person, Position):
        fields = {f.name for f in model._meta.concrete_fields}
        missing = set(model.audit_exclude_fields) - fields
        assert not missing, f"{model.__name__}.audit_exclude_fields names unknown {missing}"
