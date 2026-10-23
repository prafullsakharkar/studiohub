"""Migration operations used by masterdata migrations."""

from __future__ import annotations

from django.contrib.postgres.operations import BtreeGistExtension


class EnsureBtreeGistExtension(BtreeGistExtension):
    """``CREATE EXTENSION IF NOT EXISTS btree_gist`` on PostgreSQL, nothing elsewhere.

    Django's own reverse queries ``pg_extension`` without checking the engine, so
    reversing the migration fails on SQLite. The reverse here leaves the
    extension installed: other objects may use it, and dropping it needs
    privileges the application role may not have.
    """

    def database_backwards(self, app_label, schema_editor, from_state, to_state):
        return None
