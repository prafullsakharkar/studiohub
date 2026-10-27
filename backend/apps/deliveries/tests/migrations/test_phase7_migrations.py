"""
Deliveries migrations 0008 and 0009 on the test database.

0008 gives every existing delivery a creation row in the new history. 0009 encrypts the existing
passcodes in place, refuses (changing nothing, naming a count and never a value) when there is no
key, and decrypts them again when reversed. The database is returned to the latest migration even
when a test fails. PostgreSQL never reuses the slot of a dropped column (limit 1600 per table), so
only the two tests that must start before 0008 reverse it; the others start at 0008.
"""

from __future__ import annotations

import pytest

from apps.deliveries import passcode
from apps.deliveries.tests.migration_helpers import (
    columns,
    migrate,
    migrate_to_latest,
    restore_latest,  # noqa: F401  (a fixture, used through the mark below)
    tables,
)
from apps.identity.tests.factories import UserFactory

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("restore_latest"),
]

AT_0007 = [("deliveries", "0007_code_unique")]
AT_0008 = [("deliveries", "0008_workflow")]
AT_0009 = [("deliveries", "0009_encrypt_passcode")]


def _package(apps, code, **extra):
    return apps.get_model("deliveries", "DeliveryPackage").objects.create(
        name="n", code=code, **extra
    )


class TestHistoryBackfill0008:
    def test_each_existing_delivery_gets_a_creation_row_by_its_creator(self):
        creator = UserFactory.create()
        apps = migrate(AT_0007)
        mine = _package(apps, "OLD-1", created_by_id=creator.pk)
        orphan = _package(apps, "OLD-2")
        gone = _package(apps, "OLD-3", is_deleted=True)

        migrate(AT_0008)

        change = migrate(AT_0008).get_model("deliveries", "DeliveryStatusChange")
        rows = {r.delivery_id: r for r in change.objects.all()}
        assert set(rows) == {mine.pk, orphan.pk, gone.pk}
        assert all((r.from_status, r.to_status) == ("", "Draft") for r in rows.values())
        assert rows[mine.pk].actor_id == creator.pk and rows[orphan.pk].actor_id is None
        assert rows[mine.pk].at == mine.created_at

    def test_it_adds_the_columns_and_goes_back(self):
        apps = migrate(AT_0007)
        _package(apps, "OLD-4")

        migrate(AT_0008)
        assert "deliveries_status_change" in tables()
        assert {"signed_off_at", "rejection_reason", "revision_of_id"} <= columns(
            "deliveries_package"
        )

        migrate(AT_0007)
        assert "deliveries_status_change" not in tables()
        assert "signed_off_at" not in columns("deliveries_package")
        assert apps.get_model("deliveries", "DeliveryPackage").objects.filter(code="OLD-4").exists()


class TestPasscodeEncryption0009:
    def test_existing_passcodes_are_encrypted_in_place_deleted_rows_included(self):
        apps = migrate(AT_0008)
        live = _package(apps, "PC-1", passcode="plain-one")
        deleted = _package(apps, "PC-2", passcode="plain-two", is_deleted=True)
        empty = _package(apps, "PC-3")

        migrate(AT_0009)

        model = migrate(AT_0009).get_model("deliveries", "DeliveryPackage")
        values = {p.pk: p.passcode for p in model._base_manager.all()}
        assert passcode.is_encrypted(values[live.pk]) and "plain-one" not in values[live.pk]
        assert passcode.decrypt(values[live.pk]) == "plain-one"
        assert passcode.decrypt(values[deleted.pk]) == "plain-two"
        assert values[empty.pk] == ""

    def test_running_the_step_again_leaves_the_ciphertext_alone(self):
        import importlib

        apps = migrate(AT_0008)
        package = _package(apps, "PC-4", passcode="once")
        latest = migrate(AT_0009)
        model = latest.get_model("deliveries", "DeliveryPackage")
        first = model._base_manager.get(pk=package.pk).passcode

        step = importlib.import_module("apps.deliveries.migrations.0009_encrypt_passcode")
        step.encrypt_existing(latest, None)

        assert model._base_manager.get(pk=package.pk).passcode == first

    def test_without_a_key_it_refuses_changes_nothing_and_says_how_many(self, settings):
        apps = migrate(AT_0008)
        _package(apps, "PC-5", passcode="never-print-this")
        _package(apps, "PC-6", passcode="nor-this")
        keys = settings.DELIVERY_SECRET_KEYS
        settings.DELIVERY_SECRET_KEYS = ()

        with pytest.raises(RuntimeError) as error:
            migrate(AT_0009)

        message = str(error.value)
        assert (
            "deliveries 0009 stopped, nothing was changed" in message and "2 deliveries" in message
        )
        assert "never-print-this" not in message and "nor-this" not in message
        settings.DELIVERY_SECRET_KEYS = keys
        model = apps.get_model("deliveries", "DeliveryPackage")
        assert sorted(model._base_manager.values_list("passcode", flat=True)) == [
            "never-print-this",
            "nor-this",
        ]

    def test_without_a_key_and_without_passcodes_it_applies(self, settings):
        apps = migrate(AT_0008)
        _package(apps, "PC-7")
        settings.DELIVERY_SECRET_KEYS = ()

        migrate(AT_0009)

        settings.DELIVERY_SECRET_KEYS = ("ZGVsaXZlcnktdGVzdC1vbmx5LWtleS0wMTIzNDU2Nzg=",)

    def test_reversing_decrypts_them_and_going_forward_encrypts_again(self):
        apps = migrate(AT_0008)
        package = _package(apps, "PC-8", passcode="round-trip")
        migrate(AT_0009)

        back = migrate(AT_0008).get_model("deliveries", "DeliveryPackage")
        assert back._base_manager.get(pk=package.pk).passcode == "round-trip"

        again = migrate(AT_0009).get_model("deliveries", "DeliveryPackage")
        stored = again._base_manager.get(pk=package.pk).passcode
        assert passcode.is_encrypted(stored) and passcode.decrypt(stored) == "round-trip"

    def test_the_column_holds_the_longest_ciphertext(self):
        apps = migrate(AT_0008)
        longest = "x" * 64
        _package(apps, "PC-9", passcode=longest)

        migrate(AT_0009)

        model = migrate(AT_0009).get_model("deliveries", "DeliveryPackage")
        assert passcode.decrypt(model._base_manager.get(code="PC-9").passcode) == longest
