"""
Re-encrypt every stored delivery passcode under the current (first) DELIVERY_SECRET_KEY (TPN review TM-006).

Rotation: put the new key first in DELIVERY_SECRET_KEY and keep the old one after it, restart, run this,
then remove the old key. Idempotent. Never prints a passcode.

    manage.py delivery_rekey [--dry-run]
"""

from django.core.management.base import BaseCommand
from django.db import connection, transaction

from apps.deliveries import passcode

TABLE = "deliveries_package"


class Command(BaseCommand):
    help = "Re-encrypt delivery passcodes under the first DELIVERY_SECRET_KEY."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Count; change nothing.")

    def handle(self, *args, **options):
        rekeyed = current = 0

        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(
                f"SELECT id, passcode FROM {TABLE} "  # noqa: S608 - TABLE is a constant
                "WHERE passcode <> ''"
            )
            for pk, stored in cursor.fetchall():
                if passcode.uses_primary_key(stored):
                    current += 1
                    continue
                if not options["dry_run"]:
                    cursor.execute(
                        f"UPDATE {TABLE} SET passcode = %s WHERE id = %s",  # noqa: S608 - constant
                        [passcode.rekey(stored), pk],
                    )
                rekeyed += 1

        verb = "would rekey" if options["dry_run"] else "rekeyed"
        self.stdout.write(f"{verb}: {rekeyed}; already current: {current}")
