"""Migration 0005 (lookup catalog hardening): forward, backward, data handling.

Runs real migrations on the test database inside ``transaction=True`` tests
and always returns the schema to the latest state afterwards.
"""

from __future__ import annotations

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

BEFORE = [
    ("masterdata", "0004_remove_organizationassettypeconfig_uq_org_assettype_config_and_more")
]
AFTER = [("masterdata", "0005_lookup_catalog_hardening")]


def _migrate(targets):
    executor = MigrationExecutor(connection)
    executor.loader.build_graph()
    executor.migrate(targets)
    executor = MigrationExecutor(connection)
    return executor.loader.project_state(targets).apps


CATALOG_MODELS = (
    "MasterAssetType",
    "MasterFileType",
    "MasterReviewType",
    "MasterShotType",
    "MasterStatus",
    "MasterTaskType",
)


def _columns(table):
    with connection.cursor() as cursor:
        return {c.name for c in connection.introspection.get_table_description(cursor, table)}


@pytest.fixture
def at_before():
    """Schema at 0004; always restored to the latest migration afterwards.

    Tests that leave deliberately conflicting rows behind must not stop the
    restore, so rows are cleared first whenever the schema is still at 0004.
    """
    apps = _migrate(BEFORE)
    try:
        yield apps
    finally:
        if "is_system" not in _columns("masterdata_task_type"):
            for name in CATALOG_MODELS:
                apps.get_model("masterdata", name).objects.all().delete()
        _migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())


def _constraints(table):
    with connection.cursor() as cursor:
        return set(connection.introspection.get_constraints(cursor, table))


@pytest.mark.django_db(transaction=True)
class TestMigration0005:
    def test_reverses_and_reapplies_on_empty_tables(self, at_before):
        assert "is_system" not in _columns("masterdata_task_type")
        assert "masterdata_mastertasktype_uq_code_ci" not in _constraints("masterdata_task_type")
        _migrate(AFTER)
        assert {"is_system", "sort_order"} <= _columns("masterdata_task_type")
        assert "masterdata_mastertasktype_uq_code_ci" in _constraints("masterdata_task_type")
        assert "sort_order" not in _columns("masterdata_status")
        assert "masterdata_status_one_default" in _constraints("masterdata_status")

    def test_legacy_status_words_are_mapped_and_data_survives(self, at_before):
        TaskType = at_before.get_model("masterdata", "MasterTaskType")
        Status = at_before.get_model("masterdata", "MasterStatus")
        keep = TaskType.objects.create(code="anim", name="Animation", status="active")
        gone = TaskType.objects.create(code="old", name="Old", status="Inactive")
        odd = TaskType.objects.create(code="odd", name="Odd", status="banana")
        blank = TaskType.objects.create(code="blank", name="Blank", status="")
        stat = Status.objects.create(
            code="done", name="Done", entity_type="Task", status="deprecated"
        )

        after = _migrate(AFTER)

        TaskType, Status = (
            after.get_model("masterdata", "MasterTaskType"),
            after.get_model("masterdata", "MasterStatus"),
        )
        by_pk = {r.pk: r.status for r in TaskType.objects.all()}
        assert by_pk == {
            keep.pk: "active",
            gone.pk: "archived",
            odd.pk: "active",
            blank.pk: "active",
        }
        assert Status.objects.get(pk=stat.pk).status == "archived"
        assert TaskType.objects.get(pk=keep.pk).is_system is False
        assert TaskType.objects.get(pk=keep.pk).sort_order == 0

    def test_case_variant_duplicates_stop_the_migration_and_change_nothing(self, at_before):
        TaskType = at_before.get_model("masterdata", "MasterTaskType")
        TaskType.objects.create(code="Anim", name="One", status="active")
        TaskType.objects.create(code="ANIM", name="Two", status="inactive")

        with pytest.raises(RuntimeError) as caught:
            _migrate(AFTER)

        assert "masterdata 0005 cannot add its uniqueness constraints" in str(caught.value)
        assert "MasterTaskType: code 'anim'" in str(caught.value)
        # Rolled back: still at 0004, rows untouched (the legacy status word is kept).
        assert "is_system" not in _columns("masterdata_task_type")
        assert sorted(TaskType.objects.values_list("status", flat=True)) == ["active", "inactive"]

    def test_duplicates_among_deleted_rows_do_not_block(self, at_before):
        TaskType = at_before.get_model("masterdata", "MasterTaskType")
        TaskType.objects.create(code="Anim", name="One", status="active")
        # A soft-deleted twin under a different code spelling is fine for the constraint.
        TaskType.objects.create(code="anim2", name="Two", status="active", is_deleted=True)
        _migrate(AFTER)

    def test_two_default_statuses_for_one_entity_type_stop_the_migration(self, at_before):
        Status = at_before.get_model("masterdata", "MasterStatus")
        Status.objects.create(code="a", name="A", entity_type="Task", is_default=True)
        Status.objects.create(code="b", name="B", entity_type="Task", is_default=True)

        with pytest.raises(RuntimeError) as caught:
            _migrate(AFTER)

        assert "2 default statuses for 'Task'" in str(caught.value)

    def test_same_status_code_in_two_entity_types_is_fine(self, at_before):
        Status = at_before.get_model("masterdata", "MasterStatus")
        Status.objects.create(code="wip", name="WIP", entity_type="Task")
        Status.objects.create(code="wip2", name="WIP shot", entity_type="Shot")
        _migrate(AFTER)
