"""Reads of the account-to-directory links (ADR-0039)."""

from __future__ import annotations

from apps.identity.models import ExternalIdentity
from apps.identity.models.directory import ExternalIdentityProvider


class ExternalIdentitySelector:
    @classmethod
    def for_username(cls, username: str) -> ExternalIdentity | None:
        """The directory link for what a person typed, whatever its case."""
        username = (username or "").strip()
        if not username:
            return None
        return (
            ExternalIdentity.objects.select_related("user")
            .filter(provider=ExternalIdentityProvider.LDAP, username__iexact=username)
            .first()
        )

    @classmethod
    def for_subject(cls, subject: str) -> ExternalIdentity | None:
        return (
            ExternalIdentity.objects.select_related("user")
            .filter(provider=ExternalIdentityProvider.LDAP, subject=subject)
            .first()
        )

    @classmethod
    def is_directory_user(cls, user) -> bool:
        """Whether ``user`` signs in through the directory (its password lives there)."""
        if user is None or getattr(user, "pk", None) is None:
            return False
        return ExternalIdentity.objects.filter(
            provider=ExternalIdentityProvider.LDAP, user=user
        ).exists()
