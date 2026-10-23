"""
Database constraints that only exist on PostgreSQL.

``ExclusionConstraint`` has no SQLite equivalent: Django does not skip it there,
the migration fails with ``near "EXCLUDE": syntax error``. This subclass emits no
SQL on any other engine, so the model and migration state stay identical on every
database while only PostgreSQL enforces it. The service-level checks remain the
rule everywhere (docs/masterdata/DECISIONS.md D8: "hybrid").
"""

from __future__ import annotations

from django.contrib.postgres.constraints import ExclusionConstraint


class PostgresOnlyExclusionConstraint(ExclusionConstraint):
    @staticmethod
    def _supported(schema_editor) -> bool:
        return schema_editor.connection.vendor == "postgresql"

    def constraint_sql(self, model, schema_editor):  # pyright: ignore[reportIncompatibleMethodOverride]
        return (
            super().constraint_sql(model, schema_editor) if self._supported(schema_editor) else None
        )

    def create_sql(self, model, schema_editor):  # pyright: ignore[reportIncompatibleMethodOverride]
        return super().create_sql(model, schema_editor) if self._supported(schema_editor) else None

    def remove_sql(self, model, schema_editor):  # pyright: ignore[reportIncompatibleMethodOverride]
        return super().remove_sql(model, schema_editor) if self._supported(schema_editor) else None
