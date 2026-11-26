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
from rest_framework.exceptions import APIException

from apps.identity.services.directory.accounts import DirectoryAccountService


def _message(exc: APIException) -> str:
    detail = exc.detail
    if isinstance(detail, dict):
        detail = next(iter(detail.values()))
    if isinstance(detail, list):
        detail = detail[0]
    return str(detail)


class Command(BaseCommand):
    help = "Link a local account to a directory entry (the account then signs in through it)."

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument("username")
        parser.add_argument("--dry-run", action="store_true", help="Check; change nothing.")

    def handle(self, *args, **options):
        try:
            result = DirectoryAccountService.link(
                actor=None,
                email=options["email"],
                username=options["username"],
                dry_run=options["dry_run"],
            )
        except APIException as exc:
            raise CommandError(_message(exc)) from None
        self.stdout.write(f"{result.email} <-> {result.username} ({result.dn})")
        self.stdout.write("linked" if result.linked else "dry run: nothing changed")
