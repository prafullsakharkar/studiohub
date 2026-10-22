"""
Resolve a presented API key / PAT secret to its credential row.

One implementation behind both authenticators: lookup by the non-secret
prefix, constant-time digest comparison, expiry/active checks, a one-time
upgrade of an old-format digest, and throttled last-used bookkeeping.
"""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from .hashing import APIKeyHasher


class CredentialResolver:
    @classmethod
    def split(cls, plain: str | None) -> tuple[str, str] | None:
        """``prefix.secret`` -> (prefix, secret); anything else -> None."""

        if not plain or "." not in plain:
            return None

        prefix, secret = plain.split(".", 1)

        if not prefix or not secret:
            return None

        return prefix, secret

    @classmethod
    def resolve(cls, *, model, hash_field: str, plain: str | None):
        """
        Return the live credential for ``plain``, or ``None``.

        Live means: active, not revoked, not expired and the digest matches.
        The owner's account state is checked by the caller.
        """

        parts = cls.split(plain)

        if parts is None:
            return None

        prefix = parts[0]

        assert plain is not None  # guaranteed by split

        candidates = model.objects.filter(
            prefix=prefix,
            is_active=True,
            revoked_at__isnull=True,
        ).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()),
        )

        match = None

        # Every candidate is compared (no early exit) so timing does not
        # depend on which row matched.
        for candidate in candidates:
            if APIKeyHasher.verify(plain=plain, hashed=getattr(candidate, hash_field)):
                match = candidate

        if match is not None:
            cls._upgrade_digest(model, hash_field, match, plain)

        return match

    @classmethod
    def _upgrade_digest(cls, model, hash_field, credential, plain):
        stored = getattr(credential, hash_field)

        if not APIKeyHasher.needs_rehash(stored):
            return

        # Conditional on the old value so a concurrent rehash cannot be undone.
        model.objects.filter(pk=credential.pk, **{hash_field: stored}).update(
            **{hash_field: APIKeyHasher.hash(plain)},
        )

    @classmethod
    def touch(cls, model, credential, *, ip_address=None):
        """
        Record use at most once per ``IDENTITY_CREDENTIAL_TOUCH_SECONDS``.

        A conditional UPDATE, not a model save: no lost updates and no write
        on the hot path for a busy credential.
        """

        interval = getattr(settings, "IDENTITY_CREDENTIAL_TOUCH_SECONDS", 60)
        now = timezone.now()

        last = credential.last_used_at

        if last is not None and now - last < timedelta(seconds=interval):
            return

        fields = {"last_used_at": now}

        if ip_address:
            fields["last_used_ip"] = ip_address

        model.objects.filter(pk=credential.pk).filter(
            Q(last_used_at__isnull=True) | Q(last_used_at__lt=now - timedelta(seconds=interval)),
        ).update(**fields)
