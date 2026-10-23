"""Migration 0006 (software onto the lookup base): forward, backward, data handling."""

from __future__ import annotations

import datetime

import pytest

from apps.masterdata.tests.migration_helpers import columns, constraints, migrate, migrate_to_latest

BEFORE = [("masterdata", "0005_lookup_catalog_hardening")]
AFTER = [("masterdata", "0006_software_on_lookup_base")]


@pytest.fixture
def at_before():
    """Schema at 0005; always restored to the latest migration afterwards."""
    apps = migrate(BEFORE)
    try:
        yield apps
    finally:
        if "version_key" not in columns("masterdata_software_version"):
            apps.get_model("masterdata", "SoftwareVersion").objects.all().delete()
            apps.get_model("masterdata", "Software").objects.all().delete()
        migrate_to_latest()


def _software(apps, code="maya", name="Maya", **kw):
    return apps.get_model("masterdata", "Software").objects.create(code=code, name=name, **kw)


def _version(apps, software, version="2025", **kw):
    kw.setdefault("code", f"{software.code}-{version}")
    kw.setdefault("name", f"{software.name} {version}")
    return apps.get_model("masterdata", "SoftwareVersion").objects.create(
        software=software, version=version, **kw
    )


@pytest.mark.django_db(transaction=True)
class TestMigration0006:
    def test_reverses_and_reapplies_on_empty_tables(self, at_before):
        assert "version_key" not in columns("masterdata_software_version")
        assert "uq_software_version_per_software" in constraints("masterdata_software_version")
        migrate(AFTER)
        assert {"version_key", "sort_order", "is_system"} <= columns("masterdata_software_version")
        assert "sort_order" in columns("masterdata_software")
        assert "masterdata_softwareversion_uq_version_ci" in constraints(
            "masterdata_software_version"
        )
        assert "uq_software_version_per_software" not in constraints("masterdata_software_version")
        assert "masterdata_software_uq_code_ci" in constraints("masterdata_software")

    def test_data_survives_and_is_normalized(self, at_before):
        maya = _software(at_before, status="Inactive")
        nuke = _software(at_before, code="nuke", name="Nuke")
        blank = _version(at_before, maya, "2025", code="", name="")
        coded = _version(
            at_before, maya, "2024", code="coded-2024", name="", version_code="MAYA-24"
        )
        legacy = _version(
            at_before, nuke, "15", status="deprecated", release_date=datetime.date(2024, 1, 1)
        )
        ten = _version(at_before, nuke, "10")

        after = migrate(AFTER)

        Software, Version = (
            after.get_model("masterdata", "Software"),
            after.get_model("masterdata", "SoftwareVersion"),
        )
        assert Software.objects.get(pk=maya.pk).status == "archived"
        assert Software.objects.get(pk=nuke.pk).status == "active"
        got = Version.objects.get(pk=blank.pk)
        assert (got.name, got.code) == ("Maya 2025", "maya-2025")  # derived, nothing else touched
        assert (
            Version.objects.get(pk=coded.pk).code == "coded-2024"
        )  # an existing code is never replaced
        assert (
            Version.objects.get(pk=coded.pk).name == "Maya 2024"
        )  # only the blank name is derived
        assert Version.objects.get(pk=legacy.pk).status == "archived"
        assert Version.objects.get(pk=legacy.pk).release_date == datetime.date(2024, 1, 1)
        assert Version.objects.get(pk=ten.pk).version_key == "000000000010"
        assert Version.objects.count() == 4

    def test_case_variant_duplicate_software_stops_the_migration(self, at_before):
        _software(at_before, code="Maya", name="One")
        _software(at_before, code="MAYA", name="Two")
        with pytest.raises(RuntimeError) as caught:
            migrate(AFTER)
        assert "masterdata 0006 cannot add its constraints" in str(caught.value)
        assert "Software: code 'maya'" in str(caught.value)
        assert "version_key" not in columns("masterdata_software_version")  # rolled back

    def test_duplicate_versions_under_one_software_stop_the_migration(self, at_before):
        software = _software(at_before)
        _version(at_before, software, "2025A", code="a", name="A")
        _version(at_before, software, "2025a", code="b", name="B")
        with pytest.raises(RuntimeError) as caught:
            migrate(AFTER)
        assert "version '2025a' used 2 times under software" in str(caught.value)

    def test_end_of_support_before_release_stops_the_migration(self, at_before):
        software = _software(at_before)
        _version(
            at_before,
            software,
            release_date=datetime.date(2025, 1, 1),
            end_of_support=datetime.date(2024, 1, 1),
        )
        with pytest.raises(RuntimeError) as caught:
            migrate(AFTER)
        assert "end_of_support is before release_date" in str(caught.value)

    def test_the_same_version_and_blank_names_under_different_softwares_are_fine(self, at_before):
        a, b = _software(at_before, "a", "A"), _software(at_before, "b", "B")
        # Blank names are legal at 0005 (names were not unique) and become distinct per software.
        _version(at_before, a, "1", code="a-1", name="")
        _version(at_before, b, "1", code="b-1", name="")
        migrate(AFTER)

    def test_soft_deleted_duplicates_do_not_block(self, at_before):
        software = _software(at_before)
        _version(at_before, software, "1", code="x", name="X", is_deleted=True)
        _version(at_before, software, "1 ", code="y", name="Y")
        migrate(AFTER)

    def test_a_blank_code_is_derived_from_the_version_code_or_the_software(self, at_before):
        software = _software(at_before)
        blank = _version(at_before, software, "2025", code="", name="X", version_code="")
        after = migrate(AFTER)
        assert (
            after.get_model("masterdata", "SoftwareVersion").objects.get(pk=blank.pk).code
            == "maya-2025"
        )

    def test_a_blank_code_uses_the_version_code_when_there_is_one(self, at_before):
        software = _software(at_before)
        blank = _version(at_before, software, "2025", code="", name="X", version_code="MAYA-25")
        after = migrate(AFTER)
        assert (
            after.get_model("masterdata", "SoftwareVersion").objects.get(pk=blank.pk).code
            == "MAYA-25"
        )
