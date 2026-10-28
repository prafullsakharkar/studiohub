"""
Migrations 0006 to 0009 (and audit 0008) on the test database.

0008 and 0009 refuse, changing nothing, when existing rows would break their constraints, and say
which. The whole chain runs forward, backward, forward. The database is returned to the latest
migration even when a test fails.
"""

from __future__ import annotations

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

pytestmark = pytest.mark.django_db(transaction=True)

BEFORE = [("publishing", "0005_remove_publishdestination_uniq_publish_destination_name_per_org_and_more")]
AT_0007 = [("publishing", "0007_publish_item_links")]
AT_0008 = [("publishing", "0008_publish_item_code_unique")]
AT_0009 = [("publishing", "0009_destination_name_default")]


def migrate(targets):
    executor = MigrationExecutor(connection)
    executor.loader.build_graph()
    executor.migrate(targets)
    return MigrationExecutor(connection).loader.project_state(targets).apps


def migrate_to_latest():
    executor = MigrationExecutor(connection)
    executor.loader.build_graph()
    executor.migrate(executor.loader.graph.leaf_nodes())


def tables():
    return set(connection.introspection.table_names())


def constraint_names(table):
    with connection.cursor() as cursor:
        return set(connection.introspection.get_constraints(cursor, table))


@pytest.fixture(autouse=True)
def restore_latest():
    yield
    # The refusal tests leave their conflicting rows behind: clear them, or moving forward refuses again.
    present = tables()
    with connection.cursor() as cursor:
        for table in (
            "publishing_file_event",
            "publishing_file",
            "publishing_item",
            "publishing_destination",
        ):
            if table in present:
                cursor.execute(f"DELETE FROM {table}")
    migrate_to_latest()


def _item(apps, code, **extra):
    model = apps.get_model("publishing", "PublishItem")
    return model.objects.create(
        name="n", code=code, entity_type="Shot", entity_id="1", entity_code="SH1",
        entity_name="Shot", dcc_tool="Maya", source_file="a.ma", **extra,
    )  # fmt: skip


def _destination(apps, name, **extra):
    model = apps.get_model("publishing", "PublishDestination")
    return model.objects.create(
        name=name, destination_type="Storage Cluster", path="/mnt/x", protocol="NFS", **extra
    )


class TestCodeUniqueness0008:
    def test_it_refuses_duplicates_in_any_case_and_names_them(self):
        apps = migrate(AT_0007)
        first = _item(apps, "Dup-1")
        second = _item(apps, "dup-1")
        deleted = _item(apps, "OTHER-1", is_deleted=True)
        _item(apps, "other-1")  # collides with a soft-deleted row: deleted rows keep their code

        with pytest.raises(RuntimeError) as error:
            migrate(AT_0008)

        message = str(error.value)
        assert "publishing 0008 stopped, nothing was changed" in message
        assert "DUP-1" in message and "OTHER-1" in message
        assert str(first.pk) in message and str(second.pk) in message and str(deleted.pk) in message
        assert "publishing_item_ucode_uniq" not in constraint_names("publishing_item")
        assert apps.get_model("publishing", "PublishItem").objects.count() == 4  # nothing changed

    def test_after_the_codes_are_fixed_it_applies_and_holds(self):
        from django.db import IntegrityError, transaction

        apps = migrate(AT_0007)
        _item(apps, "Dup-1")
        second = _item(apps, "dup-1")
        with pytest.raises(RuntimeError):
            migrate(AT_0008)

        second.code = "DUP-2"
        second.save()
        apps = migrate(AT_0008)

        assert "publishing_item_ucode_uniq" in constraint_names("publishing_item")
        with pytest.raises(IntegrityError), transaction.atomic():
            _item(apps, "dup-2")

    def test_it_applies_on_an_empty_table(self):
        migrate(AT_0007)
        migrate(AT_0008)

        assert "publishing_item_ucode_uniq" in constraint_names("publishing_item")


class TestDestinations0009:
    def test_it_refuses_names_that_differ_only_in_case(self):
        apps = migrate(AT_0008)
        _destination(apps, "Client SFTP")
        _destination(apps, "client sftp")
        _destination(apps, "gone", is_deleted=True)
        _destination(apps, "GONE")  # a deleted row does not count

        with pytest.raises(RuntimeError) as error:
            migrate(AT_0009)

        message = str(error.value)
        assert "publishing 0009 stopped, nothing was changed" in message
        assert "CLIENT SFTP" in message and "GONE" not in message
        assert "uniq_publish_destination_name" in constraint_names("publishing_destination")

    def test_it_refuses_several_defaults(self):
        apps = migrate(AT_0008)
        _destination(apps, "A", is_default=True)
        _destination(apps, "B", is_default=True)

        with pytest.raises(RuntimeError, match="several defaults"):
            migrate(AT_0009)

    def test_it_applies_when_the_data_is_clean(self):
        apps = migrate(AT_0008)
        _destination(apps, "A", is_default=True)
        _destination(apps, "B")
        _destination(apps, "a", is_deleted=True)

        migrate(AT_0009)

        names = constraint_names("publishing_destination")
        assert {"publishing_destination_uname_uniq", "publishing_destination_one_default"} <= names
        assert "uniq_publish_destination_name" not in names


def test_the_chain_runs_forward_backward_forward_and_keeps_the_rows():
    apps = migrate(BEFORE)
    item = _item(apps, "KEEP-1")
    _destination(apps, "Keep")

    for _ in range(2):
        migrate(BEFORE)
        assert not {"publishing_file", "publishing_storage_root", "publishing_counter"} & tables()
        migrate_to_latest()
        assert {
            "publishing_file",
            "publishing_file_event",
            "publishing_storage_root",
            "publishing_counter",
        } <= tables()

    from apps.publishing.models import PublishItem

    assert PublishItem.objects.filter(pk=item.pk, code="KEEP-1").exists()


def test_the_audit_target_migration_is_reversible():
    before = [("audit", "0007_alter_auditlog_target_type_masterdata")]
    migrate(before)
    migrate_to_latest()

    from apps.audit.models import AuditLog

    values = {value for value, _ in AuditLog.TARGET_CHOICES}
    assert {"publishing", "scheduling", "delivery"} <= values
