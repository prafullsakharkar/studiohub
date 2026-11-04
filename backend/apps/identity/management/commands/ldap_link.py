"""
Link an existing local account to its directory entry, on purpose (ADR-0039 decision 6).

Sign-in never links by e-mail by itself (whoever controls an entry's mail attribute would take the
account over); an administrator runs this once they know the two are the same person. From then
on the account signs in with the directory username only: its local password is removed and its
sessions end.

    manage.py ldap_link <email> <directory username> [--dry-run]
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.identity.models import ExternalIdentity, User
from apps.identity.models.directory import ExternalIdentityProvider
from apps.identity.services.directory.client import DirectoryAmbiguous, DirectoryUnavailable
from apps.identity.services.directory.configuration import DirectoryConfigurationService
from apps.identity.services.directory.secret import DirectorySecretUnavailable


class Command(BaseCommand):
    help = "Link a local account to a directory entry (the account then signs in through it)."

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument("username")
        parser.add_argument("--dry-run", action="store_true", help="Check; change nothing.")

    def handle(self, *args, **options):
        from apps.identity.authentication.token import TokenService
        from apps.identity.choices import SecurityEventType
        from apps.identity.services.security_event import SecurityEventService

        user = User.objects.filter(email__iexact=options["email"].strip()).first()
        if user is None:
            raise CommandError("No account has this e-mail.")
        if ExternalIdentity.objects.filter(user=user).exists():
            raise CommandError("This account is already linked to the directory.")

        config = DirectoryConfigurationService.get()
        try:
            entry = DirectoryConfigurationService.client(config).find(options["username"])
        except (DirectoryUnavailable, DirectorySecretUnavailable) as exc:
            raise CommandError(f"The directory cannot be reached ({exc}).") from None
        except DirectoryAmbiguous:
            raise CommandError("More than one entry has this username.") from None
        if entry is None:
            raise CommandError("No directory entry has this username.")
        if ExternalIdentity.objects.filter(subject=entry.subject).exists():
            raise CommandError("This directory entry is already linked to another account.")

        self.stdout.write(f"{user.email} <-> {entry.username} ({entry.dn})")
        if options["dry_run"]:
            self.stdout.write("dry run: nothing changed")
            return

        with transaction.atomic():
            ExternalIdentity.objects.create(
                user=user,
                provider=ExternalIdentityProvider.LDAP,
                subject=entry.subject,
                username=entry.username,
                dn=entry.dn,
                last_synced_at=timezone.now(),
            )
            user.set_unusable_password()
            user.save(update_fields=["password", "updated_at"])
            TokenService.revoke_all_for_user(user=user)
            SecurityEventService.create(
                user=user,
                event_type=SecurityEventType.SETTINGS_UPDATED,
                description="Account linked to the directory by an administrator.",
                metadata={"area": "directory_link", "username": entry.username},
            )
        self.stdout.write("linked")
