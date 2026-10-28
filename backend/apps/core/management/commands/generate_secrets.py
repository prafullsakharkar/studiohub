"""
Generate fresh values for the application's secrets (TPN review TM-006).

    manage.py generate_secrets [--output FILE]

Prints ``NAME=value`` lines for the secrets an operator sets or rotates. With ``--output`` they are
written to a new file readable only by its owner (an existing file is never overwritten). Nothing is
stored or sent anywhere; the values are random and independent of each other.

Rotation is not just replacing a value: see docs/10-security/secrets-rotation.md. In particular the
two Fernet keys (MFA_ENCRYPTION_KEY, DELIVERY_SECRET_KEY) are rotated by putting the new key first and
keeping the old one in the comma-separated list until the data has been re-encrypted.
"""

from __future__ import annotations

import os
import secrets

from cryptography.fernet import Fernet
from django.core.management.base import BaseCommand, CommandError


def generate() -> dict[str, str]:
    return {
        "DJANGO_SECRET_KEY": secrets.token_urlsafe(64),
        "API_KEY_PEPPER": secrets.token_urlsafe(48),
        "MFA_ENCRYPTION_KEY": Fernet.generate_key().decode(),
        "DELIVERY_SECRET_KEY": Fernet.generate_key().decode(),
        # URL-safe so they can sit inside redis:// and postgres:// URLs unescaped.
        "REDIS_PASSWORD": secrets.token_hex(32),
        "DB_PASSWORD": secrets.token_hex(24),
    }


class Command(BaseCommand):
    help = "Generate fresh random values for the application's secrets."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output", help="Write to this new file (mode 600) instead of printing."
        )

    def handle(self, *args, **options):
        lines = [f"{name}={value}" for name, value in generate().items()]
        text = "\n".join(lines) + "\n"

        if not options["output"]:
            self.stdout.write(text, ending="")
            return

        try:
            fd = os.open(options["output"], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            raise CommandError(f"{options['output']} already exists; not overwriting.") from None

        with os.fdopen(fd, "w") as handle:
            handle.write(text)

        self.stdout.write(f"Wrote {len(lines)} values to {options['output']} (mode 600).")
