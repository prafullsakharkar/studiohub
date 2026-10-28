"""
Deliveries migrations 0004 to 0007 on the test database.

0007 refuses, changing nothing, when two delivery codes only differ in case, and says which. 0005
gives every existing item a uid. The chain runs forward, backward, forward and the database is
returned to the latest migration even when a test fails.
"""

from __future__ import annotations

import pytest

from apps.deliveries.tests.migration_helpers import (
    columns,
    constraint_names,
    migrate,
    migrate_to_latest,
    restore_latest,  # noqa: F401  (a fixture, used through the mark below)
    tables,
)
from apps.production.tests.factories import ProjectFactory, VersionFactory

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.migrations,
    pytest.mark.usefixtures("restore_latest"),
]

BEFORE = [
    (
        "deliveries",
        "0003_remove_deliverydestination_uniq_delivery_destination_name_per_org_and_more",
    )
]
AT_0004 = [("deliveries", "0004_protect_history")]
AT_0006 = [("deliveries", "0006_package_fields")]
AT_0007 = [("deliveries", "0007_code_unique")]


def _package(apps, code, **extra):
    return apps.get_model("deliveries", "DeliveryPackage").objects.create(
        name="n", code=code, **extra
    )


def _ref(apps, package, version):
    return apps.get_model("deliveries", "DeliveryVersionRef").objects.create(
        delivery=package, version_id=version.pk, version_number="v001", entity_type="Shot",
        entity_code="S", entity_name="n", file_path="p",
    )  # fmt: skip


class TestCodeUniqueness0007:
    def test_it_refuses_codes_that_differ_only_in_case_and_names_them(self):
        apps = migrate(AT_0006)
        first = _package(apps, "Dup-1")
        second = _package(apps, "dup-1")
        deleted = _package(apps, "OTHER-1", is_deleted=True)
        _package(apps, "other-1")  # deleted rows keep their code

        with pytest.raises(RuntimeError) as error:
            migrate(AT_0007)

        message = str(error.value)
        assert "deliveries 0007 stopped, nothing was changed" in message
        assert "DUP-1" in message and "OTHER-1" in message
        assert str(first.pk) in message and str(second.pk) in message and str(deleted.pk) in message
        assert "deliveries_package_ucode_uniq" not in constraint_names("deliveries_package")
        assert apps.get_model("deliveries", "DeliveryPackage").objects.count() == 4

    def test_after_the_codes_are_fixed_it_applies_and_holds(self):
        from django.db import IntegrityError, transaction

        apps = migrate(AT_0006)
        _package(apps, "Dup-1")
        second = _package(apps, "dup-1")
        with pytest.raises(RuntimeError):
            migrate(AT_0007)

        second.code = "DUP-2"
        second.save()
        apps = migrate(AT_0007)

        assert "deliveries_package_ucode_uniq" in constraint_names("deliveries_package")
        with pytest.raises(IntegrityError), transaction.atomic():
            _package(apps, "dup-2")

    def test_it_applies_on_an_empty_table(self):
        migrate(AT_0006)
        migrate(AT_0007)

        assert "deliveries_package_ucode_uniq" in constraint_names("deliveries_package")


def test_existing_items_each_get_their_own_uid():
    apps = migrate(AT_0004)
    package = _package(apps, "UID-1")
    project = ProjectFactory.create(code="UIDP")
    refs = [
        _ref(apps, package, VersionFactory.create(project=project, code=f"UV{i}")) for i in range(3)
    ]
    assert "uid" not in columns("deliveries_version_ref")

    apps = migrate([("deliveries", "0005_items_snapshot_qc")])

    uids = list(
        apps.get_model("deliveries", "DeliveryVersionRef").objects.values_list("uid", flat=True)
    )
    assert len(uids) == len(refs) == len(set(uids)) and None not in uids


def test_the_chain_runs_forward_backward_forward_and_keeps_the_rows():
    """One round trip only: PostgreSQL never reuses the slot of a dropped column (limit 1600)."""
    apps = migrate(BEFORE)
    package = _package(apps, "KEEP-1")

    migrate(BEFORE)
    assert not {"deliveries_item_file", "deliveries_qc_check", "deliveries_counter"} & tables()
    assert "sent_at" not in columns("deliveries_package")
    migrate_to_latest()
    assert {"deliveries_item_file", "deliveries_qc_check", "deliveries_counter"} <= tables()
    assert {"sent_at", "sent_by_id", "transfer_reference", "qc_run_id"} <= columns(
        "deliveries_package"
    )

    from apps.deliveries.models import DeliveryPackage

    assert DeliveryPackage.objects.filter(pk=package.pk, code="KEEP-1").exists()


def test_the_protect_migration_changes_no_table():
    """0004 changes Django's delete rule only: the columns and constraints stay as they were."""
    before = {name: columns(name) for name in ("deliveries_package", "deliveries_version_ref")}
    migrate(BEFORE)
    migrate(AT_0004)
    after = {name: columns(name) for name in ("deliveries_package", "deliveries_version_ref")}

    assert before["deliveries_package"] >= after["deliveries_package"]
    assert after["deliveries_version_ref"] == columns("deliveries_version_ref")
