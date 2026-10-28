"""
Wipe every object the application role owns in a PostgreSQL database.

For a fresh start of a development or test database: afterwards the database is empty, and
``manage.py bootstrap`` (or ``migrate``) rebuilds it. It never runs in production, and it needs the
target database named twice (``--name`` defaults to the configured one, ``--yes-wipe`` must repeat it),
so a stray command cannot wipe the wrong database.

The application role usually has no ``CREATEDB`` and cannot drop and recreate the database, so the
command drops the role's own tables and sequences in the ``public`` schema (``CASCADE``). It leaves the
database, the schema, the role's privileges and installed extensions (``btree_gist``) alone, and it
cannot drop tables another role owns: it checks afterwards and says so.
"""

from __future__ import annotations

import os
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import connections

#: environments the command may run in; anything else (production, staging, unknown) is refused
ALLOWED_ENVIRONMENTS = ("local", "testing", "ci", "docker")

_ALIAS = "reset_target"

_DROP_OWN_OBJECTS = """
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables
             WHERE schemaname = 'public' AND tableowner = current_user LOOP
        EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
    END LOOP;
    FOR r IN SELECT sequencename FROM pg_sequences
             WHERE schemaname = 'public' AND sequenceowner = current_user LOOP
        EXECUTE format('DROP SEQUENCE IF EXISTS public.%I CASCADE', r.sequencename);
    END LOOP;
END $$;
"""


def environment() -> str:
    return os.getenv("DJANGO_ENV", "local")


class Command(BaseCommand):
    help = "Drop everything the application role owns in a PostgreSQL database (dev/test only)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--name",
            help="Database to wipe on the configured server (default: the configured database).",
        )
        parser.add_argument(
            "--yes-wipe",
            metavar="NAME",
            help="Repeat the database name to confirm. Without it nothing is changed.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        env = environment()
        if env not in ALLOWED_ENVIRONMENTS:
            raise CommandError(
                f"Refusing to run with DJANGO_ENV={env!r}; allowed: {', '.join(ALLOWED_ENVIRONMENTS)}."
            )
        configured = connections["default"].settings_dict
        if "postgresql" not in configured["ENGINE"]:
            raise CommandError("Only PostgreSQL is supported; delete a SQLite file by hand.")

        name = options["name"] or configured["NAME"]
        where = f"{configured['HOST']}:{configured['PORT']}/{name} as {configured['USER']}"
        if options["yes_wipe"] != name:
            raise CommandError(
                f"This would wipe {where}. Nothing was changed.\n"
                f"To confirm, run again with --yes-wipe {name}"
            )

        self.stdout.write(f"Wiping {where} (DJANGO_ENV={env}) ...")
        before, after = self._wipe(name)
        removed = before - len(after)
        if after:
            raise CommandError(
                f"{len(after)} tables are still there because another role owns them: "
                f"{', '.join(sorted(after)[:8])}. Drop them as that role."
            )
        self.stdout.write(
            self.style.SUCCESS(f"Done: {removed} tables removed, the database is empty.")
        )

    @staticmethod
    def _tables(cursor: Any) -> list[str]:
        cursor.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')"
        )
        return [row[0] for row in cursor.fetchall()]

    def _wipe(self, name: str) -> tuple[int, list[str]]:
        """Drop the role's objects in database ``name``; returns (tables before, tables left)."""
        connections.databases[_ALIAS] = {
            **connections["default"].settings_dict,
            "NAME": name,
            "CONN_MAX_AGE": 0,
            "AUTOCOMMIT": True,
        }
        connections["default"].close()
        try:
            with connections[_ALIAS].cursor() as cursor:
                before = len(self._tables(cursor))
                cursor.execute(_DROP_OWN_OBJECTS)
                return before, self._tables(cursor)
        finally:
            connections[_ALIAS].close()
            del connections[_ALIAS]
            del connections.databases[_ALIAS]
