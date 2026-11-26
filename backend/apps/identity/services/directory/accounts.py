"""
Linking an account to the directory and bringing directory accounts in step with it (ADR-0039
decisions 6 and 10, CR-58).

The ``ldap_link`` and ``ldap_sync`` commands and the Directory (LDAP) screen
(``POST /api/v1/identity/directory/link/`` and ``…/sync/``) both call these, so the two never
drift apart.

- ``link``: sign-in never links by e-mail by itself (whoever controls an entry's mail attribute
  would take the account over); an administrator links an account once they know the two are the
  same person. From then on the account signs in with the directory username only: its local
  password is removed and its sessions end.
- ``sync``: an account whose entry is gone, no longer matches the filter (the place to exclude
  disabled accounts), or now belongs to another entry is deactivated: its sessions, tokens and keys
  end. Every other directory account has its name and e-mail refreshed. The directory is asked
  about everyone before anything changes, so an outage never deactivates anyone.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import APIException

from apps.identity.models import ExternalIdentity, User
from apps.identity.models.directory import ExternalIdentityProvider
from apps.identity.services.directory.client import DirectoryAmbiguous, DirectoryUnavailable
from apps.identity.services.directory.configuration import DirectoryConfigurationService
from apps.identity.services.directory.secret import DirectorySecretUnavailable
from apps.identity.services.directory.sign_in import DirectorySignIn


class DirectoryUnreachable(APIException):
    """The directory could not be asked (no connection, a timeout, a failed service bind, no key)."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "The directory cannot be reached; nothing changed."
    default_code = "directory_unavailable"


class DirectorySignInOff(APIException):
    """A sync needs directory sign-in to be on: there is nothing to compare with otherwise."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "Directory sign-in is off; nothing to compare with."
    default_code = "directory_sign_in_off"


@dataclass(frozen=True)
class LinkResult:
    email: str
    username: str
    dn: str
    linked: bool

    def as_dict(self) -> dict[str, Any]:
        return {
            "email": self.email,
            "username": self.username,
            "dn": self.dn,
            "linked": self.linked,
        }


@dataclass
class SyncResult:
    dry_run: bool
    refreshed: int = 0
    deactivated: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "dry_run": self.dry_run,
            "refreshed": self.refreshed,
            "deactivated": self.deactivated,
            "skipped": self.skipped,
        }


def _refused(name: str, message: str) -> serializers.ValidationError:
    return serializers.ValidationError({name: [message]})


def _unreachable(exc: Exception) -> DirectoryUnreachable:
    return DirectoryUnreachable(f"The directory cannot be reached ({exc}); nothing changed.")


class DirectoryAccountService:
    @classmethod
    def link(cls, *, actor: User | None, email: str, username: str, dry_run: bool) -> LinkResult:
        """
        Link the local account with ``email`` to the entry with ``username``.

        Raises ``ValidationError`` (on ``email`` or ``username``) when the two cannot be linked,
        ``DirectoryUnreachable`` when the directory cannot be asked.
        """
        from apps.identity.authentication.token import TokenService
        from apps.identity.choices import SecurityEventType
        from apps.identity.services.security_event import SecurityEventService

        user = User.objects.filter(email__iexact=email.strip()).first()
        if user is None:
            raise _refused("email", "No account has this e-mail.")
        if ExternalIdentity.objects.filter(user=user).exists():
            raise _refused("email", "This account is already linked to the directory.")

        config = DirectoryConfigurationService.get()
        try:
            entry = DirectoryConfigurationService.client(config).find(username)
        except (DirectoryUnavailable, DirectorySecretUnavailable) as exc:
            raise _unreachable(exc) from None
        except DirectoryAmbiguous:
            raise _refused("username", "More than one entry has this username.") from None
        if entry is None:
            raise _refused("username", "No directory entry has this username.")
        if ExternalIdentity.objects.filter(subject=entry.subject).exists():
            raise _refused("username", "This directory entry is already linked to another account.")

        result = LinkResult(email=user.email, username=entry.username, dn=entry.dn, linked=False)
        if dry_run:
            return result

        metadata: dict[str, Any] = {"area": "directory_link", "username": entry.username}
        if actor is not None:
            metadata["actor"] = str(actor.pk)
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
                metadata=metadata,
            )
        return LinkResult(email=user.email, username=entry.username, dn=entry.dn, linked=True)

    @classmethod
    def sync(cls, *, actor: User | None, dry_run: bool) -> SyncResult:
        """
        Deactivate directory accounts whose entry is gone; refresh the others.

        Raises ``DirectorySignInOff`` while directory sign-in is off and ``DirectoryUnreachable``
        (nothing changed) when the directory cannot be asked about every account.
        """
        from apps.identity.services.user import UserService

        config = DirectoryConfigurationService.active()
        if config is None:
            raise DirectorySignInOff()

        try:
            client = DirectoryConfigurationService.client(config)
            identities = list(
                ExternalIdentity.objects.select_related("user")
                .filter(provider=ExternalIdentityProvider.LDAP, user__is_active=True)
                .order_by("username")
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
            raise _unreachable(exc) from None

        result = SyncResult(dry_run=dry_run)
        for identity in identities:
            if identity.pk in ambiguous:
                result.skipped.append(identity.username)
                continue
            entry = found[identity.pk]
            if entry is None or entry.subject != identity.subject:
                result.deactivated.append(identity.username)
                if not dry_run:
                    with transaction.atomic():
                        UserService.deactivate(identity.user, user=actor)
                continue
            result.refreshed += 1
            if not dry_run:
                with transaction.atomic():
                    DirectorySignIn.refresh(identity=identity, entry=entry)
        return result
