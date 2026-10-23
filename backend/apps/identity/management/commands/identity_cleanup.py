from django.core.management.base import BaseCommand

from apps.identity.tasks.maintenance import run_cleanup


class Command(BaseCommand):
    help = (
        "Expire stale sessions and purge old login attempts and expired "
        "trusted devices. Safe to run repeatedly."
    )

    def handle(self, *args, **options):
        for name, count in run_cleanup().items():
            self.stdout.write(f"{name}: {count}")
