"""Helpers for tests that run real migrations on the test database."""

from __future__ import annotations

from django.db import connection
from django.db.migrations.executor import MigrationExecutor


def migrate(targets):
    """Migrate to ``targets``; returns the historical app registry at that state."""
    executor = MigrationExecutor(connection)
    executor.loader.build_graph()
    executor.migrate(targets)
    return MigrationExecutor(connection).loader.project_state(targets).apps


def migrate_to_latest():
    migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())


def columns(table):
    with connection.cursor() as cursor:
        return {c.name for c in connection.introspection.get_table_description(cursor, table)}


def constraints(table):
    with connection.cursor() as cursor:
        return set(connection.introspection.get_constraints(cursor, table))
