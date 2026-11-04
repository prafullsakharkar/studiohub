"""
Directory sign-in: check a username and password against the directory, then make or refresh the
account (ADR-0039 decisions 2, 6, 7 and 9).

Every failure is the one generic ``InvalidCredentials`` a wrong local password gives; the precise
cause travels on ``internal_reason`` for the login-attempt ledger, and ``user`` (when known) for the
ledger and the security events. Nothing here starts a session: ``AuthenticationService.login``
does that, the same way for both kinds of account.
"""

from __future__ import annotations

import logging

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.identity.authentication.exceptions import InvalidCredentials
from apps.identity.choices import LoginAttemptReason
from apps.identity.models import DirectoryConfiguration, ExternalIdentity, User
from apps.identity.models.directory import ExternalIdentityProvider
from apps.identity.selectors.external_identity import ExternalIdentitySelector
from apps.identity.services.directory.client import (
    DirectoryAmbiguous,
    DirectoryEntry,
    DirectoryUnavailable,
)
from apps.identity.services.directory.configuration import DirectoryConfigurationService
from apps.identity.services.directory.secret import DirectorySecretUnavailable

logger = logging.getLogger(__name__)

PROVIDER = ExternalIdentityProvider.LDAP


def _refuse(reason: str, user=None) -> InvalidCredentials:
    exc = InvalidCredentials(reason=reason)
    exc.user = user  # pyright: ignore[reportAttributeAccessIssue]
    return exc


class DirectorySignIn:
    """The directory half of ``AuthenticationService.login``."""

    @classmethod
    def identity_for(cls, username: str) -> ExternalIdentity | None:
        return ExternalIdentitySelector.for_username(username)

    @classmethod
    def is_directory_user(cls, user) -> bool:
        return ExternalIdentitySelector.is_directory_user(user)

    @classmethod
    def applies(cls, *, identity: ExternalIdentity | None) -> bool:
        """Whether the directory decides this attempt: a directory user, or sign-in is on."""
        return identity is not None or DirectoryConfigurationService.active() is not None

    # ------------------------------------------------------------------
    # The check
    # ------------------------------------------------------------------

    @classmethod
    def authenticate(cls, *, username: str, password: str, identity: ExternalIdentity | None):
        """The account for a directory username and password, or ``InvalidCredentials``."""
        known = identity.user if identity is not None else None
        config = DirectoryConfigurationService.active()

        if config is None:
            # A directory user while sign-in is off; an unknown name never gets here.
            raise _refuse(LoginAttemptReason.DIRECTORY_OFF, known)

        if not password:
            raise _refuse(LoginAttemptReason.INVALID_PASSWORD, known)

        try:
            entry = DirectoryConfigurationService.client(config).authenticate(
                username.strip(), password
            )
        except (DirectoryUnavailable, DirectorySecretUnavailable) as exc:
            logger.warning(
                "directory: sign-in failed closed, the directory is unavailable [%s]", exc
            )
            raise _refuse(LoginAttemptReason.DIRECTORY_UNAVAILABLE, known) from None
        except DirectoryAmbiguous:
            logger.warning("directory: more than one entry matches a username; refused")
            raise _refuse(LoginAttemptReason.DIRECTORY_AMBIGUOUS, known) from None

        if entry is None:
            reason = (
                LoginAttemptReason.INVALID_PASSWORD
                if known is not None
                else LoginAttemptReason.UNKNOWN_USER
            )
            raise _refuse(reason, known)

        linked = (
            ExternalIdentity.objects.select_related("user")
            .filter(provider=PROVIDER, subject=entry.subject)
            .first()
        )

        if linked is None and identity is not None:
            # The username now names another entry (the old one was removed and the name given
            # to someone else): never hand the old account to the new entry.
            logger.warning("directory: a username moved to a different entry; refused")
            raise _refuse(LoginAttemptReason.DIRECTORY_AMBIGUOUS, known)

        if linked is not None:
            cls.refresh(identity=linked, entry=entry)
            return linked.user

        return cls.provision(entry=entry, config=config)

    # ------------------------------------------------------------------
    # Accounts
    # ------------------------------------------------------------------

    @classmethod
    def provision(cls, *, entry: DirectoryEntry, config: DirectoryConfiguration):
        """
        The first sign-in of a directory entry: the account, its profile, the link and the default
        role. The People record follows after commit (DOM-MD-PER-10).
        """
        from apps.identity.services.user import UserService

        if not entry.email:
            logger.warning("directory: the entry has no e-mail; no account was made")
            raise _refuse(LoginAttemptReason.DIRECTORY_NO_EMAIL)

        email = UserService._normalized_email(entry.email)

        if User.all_objects.filter(email__iexact=email).exists():
            # Never take over a local account by e-mail: whoever controls the entry's mail
            # attribute would sign in as it. An administrator links the two on purpose.
            logger.warning("directory: the entry's e-mail belongs to an account; not linked")
            raise _refuse(LoginAttemptReason.DIRECTORY_EMAIL_CONFLICT)

        try:
            with transaction.atomic():
                user = UserService.create(email=email)
                user.set_unusable_password()
                user.save(update_fields=["password"])
                cls._write_profile(user, entry)
                ExternalIdentity.objects.create(
                    user=user,
                    provider=PROVIDER,
                    subject=entry.subject,
                    username=entry.username,
                    dn=entry.dn,
                    last_synced_at=timezone.now(),
                )
                cls._grant_default_role(user, config.default_role_code)
                cls._record_created(user, entry)
        except IntegrityError:
            # Two first sign-ins at once: the other one made the account.
            linked = (
                ExternalIdentity.objects.select_related("user")
                .filter(provider=PROVIDER, subject=entry.subject)
                .first()
            )
            if linked is None:
                raise
            return linked.user

        return user

    @classmethod
    def refresh(cls, *, identity: ExternalIdentity, entry: DirectoryEntry) -> None:
        """Copy the name and e-mail from the directory (decision 7)."""
        user = identity.user

        identity.username = entry.username or identity.username
        identity.dn = entry.dn
        identity.last_synced_at = timezone.now()
        identity.save(update_fields=["username", "dn", "last_synced_at"])

        email = (entry.email or "").strip().lower()
        if email and email != user.email:
            if User.all_objects.filter(email__iexact=email).exclude(pk=user.pk).exists():
                logger.warning(
                    "directory: a new e-mail is used by another account; kept the old one"
                )
            else:
                user.email = email
                user.save(update_fields=["email", "updated_at"])

        cls._write_profile(user, entry)

    @classmethod
    def _write_profile(cls, user, entry: DirectoryEntry) -> None:
        from apps.identity.models import Profile

        profile, _ = Profile.objects.get_or_create(user=user)
        wanted = {
            "first_name": entry.first_name[:100],
            "last_name": entry.last_name[:100],
            "display_name": (entry.display_name or f"{entry.first_name} {entry.last_name}".strip())[
                :150
            ],
        }
        changed = [
            name for name, value in wanted.items() if value and getattr(profile, name) != value
        ]
        if not changed:
            return
        for name in changed:
            setattr(profile, name, wanted[name])
        profile.save(update_fields=[*changed, "updated_at"])

    @classmethod
    def _grant_default_role(cls, user, role_code: str) -> None:
        from apps.identity.models import Role
        from apps.identity.services.rbac import RoleService

        role = Role.objects.filter(code=role_code, is_active=True, is_deleted=False).first()
        if role is None:
            logger.warning("directory: the default role %r does not exist; none granted", role_code)
            return
        RoleService.grant_on_provisioning(role=role, user=user)

    @classmethod
    def _record_created(cls, user, entry: DirectoryEntry) -> None:
        from apps.identity.choices import SecurityEventType
        from apps.identity.services.security_event import SecurityEventService

        SecurityEventService.create(
            user=user,
            event_type=SecurityEventType.USER_CREATED,
            description="Account created at its first directory sign-in.",
            metadata={"provider": PROVIDER.value, "username": entry.username},
        )
