from django.core.management.base import BaseCommand, CommandError
from django.db import connection

from apps.identity import crypto

TABLE = "identity_user_mfa"


class Command(BaseCommand):
    help = (
        "Encrypt TOTP secrets that are stored in plaintext. Use after turning "
        "MFA_ENCRYPTION_ENABLED back on. Idempotent; needs MFA_ENCRYPTION_KEY."
    )

    def handle(self, *args, **options):
        if not crypto.enabled():
            raise CommandError("MFA_ENCRYPTION_ENABLED is false; nothing to do.")

        converted = 0

        with connection.cursor() as cursor:
            cursor.execute(
                f"SELECT id, totp_secret FROM {TABLE} "
                "WHERE totp_secret <> '' AND totp_secret NOT LIKE %s",
                [crypto.PREFIX + "%"],
            )

            for pk, secret in cursor.fetchall():
                cursor.execute(
                    f"UPDATE {TABLE} SET totp_secret = %s WHERE id = %s",
                    [crypto.encrypt(secret), pk],
                )
                converted += 1

        self.stdout.write(f"encrypted: {converted}")
