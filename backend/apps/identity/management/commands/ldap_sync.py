"""
Bring directory accounts in step with the directory (ADR-0039 decision 10).

An account whose entry is gone, no longer matches the filter (the place to exclude disabled
accounts), or now belongs to another entry is deactivated: its sessions, tokens and keys end. Every
other directory account has its name and e-mail refreshed. If the directory cannot be reached the
command stops and changes nothing, so an outage never deactivates anyone. Run it on a schedule.

    manage.py ldap_sync [--dry-run]
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from rest_framework.exceptions import APIException

from apps.identity.services.directory.accounts import DirectoryAccountService


class Command(BaseCommand):
    help = "Deactivate directory accounts whose entry is gone; refresh the others."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Report; change nothing.")

    def handle(self, *args, **options):
        dry = options["dry_run"]
        try:
            result = DirectoryAccountService.sync(actor=None, dry_run=dry)
        except APIException as exc:
            raise CommandError(str(exc.detail)) from None
        for username in result.skipped:
            self.stdout.write(f"skipped (more than one entry matches): {username}")
        for username in result.deactivated:
            self.stdout.write(f"{'would deactivate' if dry else 'deactivated'}: {username}")
        verb = "would refresh" if dry else "refreshed"
        self.stdout.write(f"{verb}: {result.refreshed}; deactivated: {len(result.deactivated)}")
