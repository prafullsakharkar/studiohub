"""
Purge audit rows past their retention window (cron / deployments without Celery beat).

    manage.py audit_purge [--dry-run]
"""

from django.core.management.base import BaseCommand

from apps.audit.services.retention import purge_expired


class Command(BaseCommand):
    help = "Delete audit rows older than AUDIT_RETENTION_DAYS, API_REQUEST_RETENTION_DAYS and TRACK_RETENTION_DAYS."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true", help="Report what would be removed; delete nothing."
        )

    def handle(self, *args, **options):
        counts = purge_expired(dry_run=options["dry_run"])
        verb = "Would remove" if options["dry_run"] else "Removed"

        for table, count in counts.items():
            self.stdout.write(f"{verb} {count} row(s) from {table}")
