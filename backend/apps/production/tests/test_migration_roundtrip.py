"""
Migrations 0023 (StatusHistory) and 0024 (override_kind, adjustment_of) run forward,
backward, forward on the test database.

The migrations are additive, so reversing them drops only what they added and keeps
the rest of the rows. The test restores the database to the latest migration even
when it fails.
"""

from __future__ import annotations

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

from apps.production.tests.factories import ProjectFactory, TaskFactory, TimelogFactory

pytestmark = [pytest.mark.django_db(transaction=True), pytest.mark.migrations]

BEFORE = [("production", "0022_remove_asset_production__organiz_4d58b7_idx_and_more")]
AFTER_0023 = [("production", "0023_status_history")]


def _migrate(targets):
    executor = MigrationExecutor(connection)
    executor.migrate(targets)
    executor = MigrationExecutor(connection)  # reload the graph and applied state
    return executor


def _columns(table):
    with connection.cursor() as cursor:
        return {col.name for col in connection.introspection.get_table_description(cursor, table)}


def _tables():
    return set(connection.introspection.table_names())


def _latest():
    return MigrationExecutor(connection).loader.graph.leaf_nodes("production")


def test_forward_backward_forward():
    latest = _latest()
    project = ProjectFactory.create(code="MIG01")
    log = TimelogFactory.create(task=TaskFactory.create(project=project, code="T1"))
    try:
        for _ in range(2):
            # back to before the status history existed
            _migrate(BEFORE)
            assert "production_status_history" not in _tables()
            assert "adjustment_of_id" not in _columns("production_timelog")
            from django.db import connection as conn

            with conn.cursor() as cursor:
                cursor.execute("SELECT count(*) FROM production_timelog WHERE id = %s", [log.pk])
                assert cursor.fetchone()[0] == 1  # reversing drops what was added, not the rows

            # forward one step at a time
            _migrate(AFTER_0023)
            assert "production_status_history" in _tables()
            assert "override_kind" not in _columns("production_status_history")
            assert "adjustment_of_id" not in _columns("production_timelog")

            _migrate(latest)
            assert "override_kind" in _columns("production_status_history")
            assert "adjustment_of_id" in _columns("production_timelog")
    finally:
        _migrate(latest)
