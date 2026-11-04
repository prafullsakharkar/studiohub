from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.masterdata.models import Person
from apps.masterdata.services.user_person import ensure_person_for_user


class Command(BaseCommand):
    help = (
        "Give every user without one a person (DOM-MD-PER-10): adopt an unlinked person with the "
        "user's e-mail, else create one. Idempotent; --dry-run only counts."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true", help="Count the users, change nothing."
        )

    def handle(self, *args, **options):
        linked = set(Person.objects.exclude(user__isnull=True).values_list("user_id", flat=True))
        missing = [
            pk for pk in get_user_model().objects.values_list("pk", flat=True) if pk not in linked
        ]

        if options["dry_run"]:
            self.stdout.write(f"users without a person: {len(missing)}")
            return

        counts = {"created": 0, "linked": 0, "exists": 0, "failed": 0}
        for pk in missing:
            counts[ensure_person_for_user(pk)] += 1

        self.stdout.write(
            "created: {created}, adopted: {linked}, already linked: {exists}, failed: {failed}".format(
                **counts
            )
        )
