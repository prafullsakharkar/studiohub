"""Migration 0009 (drop the catalogs' ``scope`` column): forward, backward, loud failure."""

from __future__ import annotations

import pytest

from apps.masterdata.tests.migration_helpers import columns, migrate, migrate_to_latest

BEFORE = [("masterdata", "0008_directory_hardening")]
AFTER = [("masterdata", "0009_drop_catalog_scope")]

TABLES = (
    "masterdata_software",
    "masterdata_software_version",
)


@pytest.fixture
def at_before():
    """Schema at 0008 (the column exists); cleared and restored to the latest afterwards."""
    apps = migrate(BEFORE)
    try:
        yield apps
    finally:
        if "scope" in columns("masterdata_software"):
            apps.get_model("masterdata", "SoftwareVersion").objects.all().delete()
            apps.get_model("masterdata", "Software").objects.all().delete()
            apps.get_model("masterdata", "MasterStatus").objects.all().delete()
        migrate_to_latest()


@pytest.mark.django_db(transaction=True)
class TestMigration0009:
    def test_drops_and_restores_the_column_on_empty_tables(self, at_before):
        assert all("scope" in columns(t) for t in TABLES)
        migrate(AFTER)
        assert not any("scope" in columns(t) for t in TABLES)
        migrate(BEFORE)  # reverse: the column comes back
        assert all("scope" in columns(t) for t in TABLES)

    def test_existing_rows_survive_and_come_back_global(self, at_before):
        Software = at_before.get_model("masterdata", "Software")
        row = Software.objects.create(code="maya", name="Maya")
        after = migrate(AFTER)
        assert after.get_model("masterdata", "Software").objects.filter(pk=row.pk).exists()
        back = migrate(BEFORE)
        assert back.get_model("masterdata", "Software").objects.get(pk=row.pk).scope == "GLOBAL"

    def test_a_row_that_is_not_global_stops_the_migration(self, at_before):
        at_before.get_model("masterdata", "Software").objects.create(
            code="orgx", name="Org X", scope="ORGANIZATION"
        )
        with pytest.raises(RuntimeError) as caught:
            migrate(AFTER)
        assert "cannot drop the scope column" in str(caught.value)
        assert "Software" in str(caught.value) and "ORGANIZATION" in str(caught.value)
        assert "scope" in columns("masterdata_software")  # rolled back

    def test_a_soft_deleted_non_global_row_stops_it_too(self, at_before):
        at_before.get_model("masterdata", "MasterStatus").objects.create(
            code="x", name="X", entity_type="Task", scope="ORGANIZATION", is_deleted=True
        )
        with pytest.raises(RuntimeError):
            migrate(AFTER)
