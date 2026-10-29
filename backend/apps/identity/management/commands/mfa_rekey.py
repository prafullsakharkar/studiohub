"""
Re-encrypt every stored TOTP secret under the current (first) MFA_ENCRYPTION_KEY (TPN review TM-006).

Rotation: put the new key first in MFA_ENCRYPTION_KEY and keep the old one after it, restart, run this,
then remove the old key. Idempotent. Never prints a secret.

    manage.py mfa_rekey [--dry-run]
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

from apps.identity import crypto

TABLE = "identity_user_mfa"


class Command(BaseCommand):
    help = "Re-encrypt TOTP secrets under the first MFA_ENCRYPTION_KEY."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Count; change nothing.")

    def handle(self, *args, **options):
        if not crypto.enabled():
            raise CommandError("MFA_ENCRYPTION_ENABLED is false; nothing is encrypted.")

        rekeyed = current = 0

        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(
                f"SELECT id, totp_secret FROM {TABLE} "  # noqa: S608 - TABLE is a constant
                "WHERE totp_secret LIKE %s",
                [crypto.PREFIX + "%"],
            )
            for pk, secret in cursor.fetchall():
                if crypto.uses_primary_key(secret):
                    current += 1
                    continue
                if not options["dry_run"]:
                    cursor.execute(
                        f"UPDATE {TABLE} SET totp_secret = %s WHERE id = %s",  # noqa: S608 - constant
                        [crypto.rekey(secret), pk],
                    )
                rekeyed += 1

        verb = "would rekey" if options["dry_run"] else "rekeyed"
        self.stdout.write(f"{verb}: {rekeyed}; already current: {current}")
