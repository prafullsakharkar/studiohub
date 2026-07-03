from django.core.management.base import BaseCommand

from apps.identity.seeds.runner import (
    IdentitySeeder,
)


class Command(BaseCommand):

    help = "Seed identity data."

    def handle(self, *args, **kwargs):

        IdentitySeeder.run()

        self.stdout.write(self.style.SUCCESS("Identity seed completed."))
