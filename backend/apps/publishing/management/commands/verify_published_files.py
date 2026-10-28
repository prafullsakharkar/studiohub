from django.core.management.base import BaseCommand

from apps.publishing.tasks.verify import verify_pending


class Command(BaseCommand):
    help = (
        "Verify the SHA-256 of registered files whose checksum is only declared, on storage "
        "roots listed in PUBLISHING_STORAGE_MOUNTS. Records verified, mismatch or missing; never "
        "changes a declared checksum. Safe to repeat. Prints counts only."
    )

    def add_arguments(self, parser):
        parser.add_argument("--root", help="Only this storage root code.")
        parser.add_argument("--limit", type=int, help="At most this many files in one run.")

    def handle(self, *args, **options):
        counts = verify_pending(root=options["root"], limit=options["limit"])
        self.stdout.write(
            "verified: {verified}, mismatch: {mismatch}, missing: {missing}, skipped: {skipped}".format(
                **counts
            )
        )
