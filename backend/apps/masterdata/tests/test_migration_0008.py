"""Migration 0008 (directory hardening): forward, backward, loud failures on conflicting data."""

from __future__ import annotations

import pytest

from apps.masterdata.tests.migration_helpers import constraints, migrate, migrate_to_latest

BEFORE = [("masterdata", "0007_clients_vendors_hardening")]
AFTER = [("masterdata", "0008_directory_hardening")]

NEW_CONSTRAINTS = {
    "masterdata_department": {
        "masterdata_department_uq_code_ci",
        "masterdata_department_uq_name_ci",
        "masterdata_department_parent_not_self",
    },
    "masterdata_team": {"masterdata_team_uq_code_ci", "masterdata_team_uq_name_ci"},
    "masterdata_office": {
        "masterdata_office_uq_code_ci",
        "masterdata_office_uq_name_ci",
        "masterdata_office_one_headquarters",
    },
    "masterdata_position": {
        "masterdata_position_uq_code_ci",
        "masterdata_position_uq_name_ci",
        "masterdata_position_parent_not_self",
        "masterdata_position_level_min_1",
    },
    "masterdata_person": {"masterdata_person_uq_email_ci"},
}


@pytest.fixture
def at_before():
    """Schema at 0007; the data is cleared and the schema restored to the latest afterwards."""
    apps = migrate(BEFORE)
    try:
        yield apps
    finally:
        if "masterdata_department_uq_code_ci" not in constraints("masterdata_department"):
            for name in ("Person", "Team", "Position", "Office"):
                apps.get_model("masterdata", name).objects.all().delete()
            apps.get_model("masterdata", "Department").objects.all().update(parent=None)
            apps.get_model("masterdata", "Department").objects.all().delete()
        migrate_to_latest()


def dept(apps, code="COMP", name=None, **kw):
    return apps.get_model("masterdata", "Department").objects.create(
        code=code, name=name or code, department_type="creative", **kw
    )


def office(apps, code="LON", name=None, **kw):
    return apps.get_model("masterdata", "Office").objects.create(
        code=code,
        name=name or code,
        office_type="studio",
        timezone="Europe/London",
        country="UK",
        city="London",
        **kw,
    )


@pytest.mark.django_db(transaction=True)
class TestMigration0008:
    def test_reverses_and_reapplies_on_empty_tables(self, at_before):
        for table, names in NEW_CONSTRAINTS.items():
            assert not names & constraints(table)
        migrate(AFTER)
        for table, names in NEW_CONSTRAINTS.items():
            assert names <= constraints(table), table

    def test_clean_data_survives_untouched(self, at_before):
        root = dept(at_before, "A")
        child = dept(at_before, "B", parent=root)
        hq = office(at_before, "HQ", is_headquarters=True)
        after = migrate(AFTER)
        assert (
            after.get_model("masterdata", "Department").objects.get(pk=child.pk).parent_id
            == root.pk
        )
        assert after.get_model("masterdata", "Office").objects.get(pk=hq.pk).is_headquarters

    def test_case_variant_codes_stop_the_migration(self, at_before):
        dept(at_before, "Comp", "One")
        dept(at_before, "COMP", "Two")
        with pytest.raises(RuntimeError) as caught:
            migrate(AFTER)
        message = str(caught.value)
        assert "masterdata 0008 cannot add its constraints" in message
        assert "Department: code 'comp' used by 2 rows" in message
        assert "masterdata_department_uq_code_ci" not in constraints("masterdata_department")

    def test_duplicate_names_stop_the_migration(self, at_before):
        dept(at_before, "A", "Same")
        dept(at_before, "B", "same")
        with pytest.raises(RuntimeError) as caught:
            migrate(AFTER)
        assert "Department: name 'same' used by 2 rows" in str(caught.value)

    def test_a_self_parent_stops_the_migration(self, at_before):
        row = dept(at_before, "A")
        type(row).objects.filter(pk=row.pk).update(parent=row)
        with pytest.raises(RuntimeError) as caught:
            migrate(AFTER)
        assert "its own parent" in str(caught.value)

    def test_two_headquarters_stop_the_migration(self, at_before):
        office(at_before, "A", is_headquarters=True)
        office(at_before, "B", is_headquarters=True)
        with pytest.raises(RuntimeError) as caught:
            migrate(AFTER)
        assert "Office: 2 headquarters" in str(caught.value)

    def test_a_position_level_below_one_stops_the_migration(self, at_before):
        at_before.get_model("masterdata", "Position").objects.create(code="P", name="P", level=0)
        with pytest.raises(RuntimeError) as caught:
            migrate(AFTER)
        assert "level 0 is below 1" in str(caught.value)

    def test_one_email_for_two_people_stops_the_migration(self, at_before):
        Person = at_before.get_model("masterdata", "Person")
        Person.objects.create(name="A", email="a@x.io")
        Person.objects.create(name="B", email="A@X.io")
        with pytest.raises(RuntimeError) as caught:
            migrate(AFTER)
        assert "one e-mail used by 2 people" in str(caught.value)

    def test_deleted_rows_and_blank_emails_do_not_block(self, at_before):
        dept(at_before, "Comp", "One", is_deleted=True)
        dept(at_before, "COMP", "One")
        Person = at_before.get_model("masterdata", "Person")
        Person.objects.create(name="A", email="")
        Person.objects.create(name="B", email="")
        migrate(AFTER)
