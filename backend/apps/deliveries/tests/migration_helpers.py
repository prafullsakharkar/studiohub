"""Helpers for the migration tests: move the test database along the deliveries chain and back."""

from __future__ import annotations

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

CHAIN_TABLES = (
    "deliveries_status_change",
    "deliveries_qc_check",
    "deliveries_item_file",
    "deliveries_version_ref",
    "deliveries_package",
)


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


def columns(table):
    with connection.cursor() as cursor:
        return {c.name for c in connection.introspection.get_table_description(cursor, table)}


def clear_deliveries():
    """Delete the rows the tests leave behind, children first, so moving forward cannot refuse."""
    present = tables()
    with connection.cursor() as cursor:
        for table in CHAIN_TABLES:
            if table in present:
                cursor.execute(f"DELETE FROM {table}")


@pytest.fixture
def restore_latest():
    yield
    clear_deliveries()
    migrate_to_latest()
