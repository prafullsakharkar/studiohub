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
from django.db import transaction

from apps.identity.models import ExternalIdentity
from apps.identity.models.directory import ExternalIdentityProvider
from apps.identity.services.directory.client import DirectoryAmbiguous, DirectoryUnavailable
from apps.identity.services.directory.configuration import DirectoryConfigurationService
from apps.identity.services.directory.secret import DirectorySecretUnavailable
from apps.identity.services.directory.sign_in import DirectorySignIn


class Command(BaseCommand):
    help = "Deactivate directory accounts whose entry is gone; refresh the others."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Report; change nothing.")

    def handle(self, *args, **options):
        from apps.identity.services.user import UserService

        dry = options["dry_run"]
        config = DirectoryConfigurationService.active()
        if config is None:
            raise CommandError("Directory sign-in is off; nothing to compare with.")

        try:
            client = DirectoryConfigurationService.client(config)
            identities = list(
                ExternalIdentity.objects.select_related("user").filter(
                    provider=ExternalIdentityProvider.LDAP, user__is_active=True
                )
            )
            # Ask the directory about everyone first: an outage half-way through changes nothing.
            found = {}
            ambiguous = set()
            for identity in identities:
                try:
                    found[identity.pk] = client.find(identity.username)
                except DirectoryAmbiguous:
                    # A filter that matches too much is a configuration fault, not a leaver.
                    ambiguous.add(identity.pk)
        except (DirectoryUnavailable, DirectorySecretUnavailable) as exc:
            raise CommandError(
                f"The directory cannot be reached ({exc}); nothing changed."
            ) from None

        refreshed = deactivated = 0
        for identity in identities:
            if identity.pk in ambiguous:
                self.stdout.write(f"skipped (more than one entry matches): {identity.username}")
                continue
            entry = found[identity.pk]
            label = identity.username
            if entry is None or entry.subject != identity.subject:
                deactivated += 1
                self.stdout.write(f"{'would deactivate' if dry else 'deactivated'}: {label}")
                if not dry:
                    with transaction.atomic():
                        UserService.deactivate(identity.user)
                continue
            refreshed += 1
            if not dry:
                with transaction.atomic():
                    DirectorySignIn.refresh(identity=identity, entry=entry)

        verb = "would refresh" if dry else "refreshed"
        self.stdout.write(f"{verb}: {refreshed}; deactivated: {deactivated}")
