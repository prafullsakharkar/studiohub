"""Helpers for the migration tests: move the test database along the scheduling chain and back."""

from __future__ import annotations

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

# Children first, so deleting never meets a PROTECT or a foreign key.
CHAIN_TABLES = (
    "scheduling_milestone",
    "scheduling_resource_schedule",
    "scheduling_resource_leave",
    "scheduling_calendar_event",
    "scheduling_holiday",
    "scheduling_resource",
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


def clear_scheduling():
    """
    Delete the rows the tests leave behind so moving forward cannot refuse. Calendars other than
    the default go too (once the table exists); the default stays, as the migration seeded it.
    """
    present = tables()
    with connection.cursor() as cursor:
        for table in CHAIN_TABLES:
            if table in present:
                cursor.execute(f"DELETE FROM {table}")
        if "scheduling_work_calendar" in present:
            cursor.execute("DELETE FROM scheduling_work_calendar WHERE is_default = false")


@pytest.fixture
def restore_latest():
    yield
    clear_scheduling()
    migrate_to_latest()
