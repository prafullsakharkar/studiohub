"""
Deliveries migration 0010 on the test database.

It refuses, changing nothing, while two live destinations share a name once case is ignored or
more than one live destination is the default, and says which. Otherwise it adds the destination
link, replaces the name constraint and adds the one-default constraint, and it reverses. The
database is returned to the latest migration even when a test fails. Deleted destinations are
ignored by both rules.
"""

from __future__ import annotations

import pytest

from apps.deliveries.tests.migration_helpers import (
    columns,
    constraint_names,
    migrate,
    restore_latest,  # noqa: F401  (a fixture, used through the mark below)
)

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("restore_latest"),
]

AT_0009 = [("deliveries", "0009_encrypt_passcode")]
AT_0010 = [("deliveries", "0010_destinations")]


def _destination(apps, name, **extra):
    return apps.get_model("deliveries", "DeliveryDestination").objects.create(
        name=name, destination_type="AWS S3 Bucket", endpoint="s3://x", **extra
    )


def test_it_refuses_names_that_differ_only_in_case_and_names_them():
    apps = migrate(AT_0009)
    first = _destination(apps, "Hub")
    second = _destination(apps, "HUB")
    _destination(apps, "Fine")

    with pytest.raises(RuntimeError) as error:
        migrate(AT_0010)

    message = str(error.value)
    assert "deliveries 0010 stopped, nothing was changed" in message
    assert "name HUB" in message and str(first.pk) in message and str(second.pk) in message
    assert "deliveries_dest_uname_live_uniq" not in constraint_names("deliveries_destination")
    assert "destination_id" not in columns("deliveries_package")


def test_it_refuses_more_than_one_default_and_lists_them():
    apps = migrate(AT_0009)
    one = _destination(apps, "One", is_default=True)
    two = _destination(apps, "Two", is_default=True)

    with pytest.raises(RuntimeError) as error:
        migrate(AT_0010)

    message = str(error.value)
    assert "more than one default" in message
    assert str(one.pk) in message and str(two.pk) in message
    assert "deliveries_dest_one_default" not in constraint_names("deliveries_destination")


def test_deleted_destinations_do_not_count():
    apps = migrate(AT_0009)
    _destination(apps, "Hub")
    _destination(apps, "HUB", is_deleted=True)
    _destination(apps, "Old default", is_default=True, is_deleted=True)
    _destination(apps, "Live default", is_default=True)

    migrate(AT_0010)

    names = constraint_names("deliveries_destination")
    assert {"deliveries_dest_uname_live_uniq", "deliveries_dest_one_default"} <= names


def test_it_applies_and_reverses_keeping_the_destinations():
    apps = migrate(AT_0009)
    _destination(apps, "Keep me")
    assert "uniq_delivery_destination_name" in constraint_names("deliveries_destination")

    migrate(AT_0010)
    names = constraint_names("deliveries_destination")
    assert "uniq_delivery_destination_name" not in names
    assert {"deliveries_dest_uname_live_uniq", "deliveries_dest_one_default"} <= names
    assert "destination_id" in columns("deliveries_package")

    back = migrate(AT_0009)
    assert "destination_id" not in columns("deliveries_package")
    assert "uniq_delivery_destination_name" in constraint_names("deliveries_destination")
    assert (
        back.get_model("deliveries", "DeliveryDestination").objects.filter(name="Keep me").exists()
    )


def test_a_destination_in_use_cannot_be_hard_deleted_after_the_migration():
    from django.db.models import ProtectedError

    apps = migrate(AT_0010)
    destination = _destination(apps, "In use")
    package = apps.get_model("deliveries", "DeliveryPackage").objects.create(
        name="n", code="DEST-USE", destination=destination
    )

    with pytest.raises(ProtectedError):
        destination.delete()
    assert package.destination_id == destination.pk
