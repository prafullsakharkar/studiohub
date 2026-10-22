"""
Lifecycle of API keys and personal access tokens (A5, WP 7.1/7.2).

One service over both tables. A credential is minted for exactly one owner,
its secret exists only in the value returned by ``create``/``rotate``, and
only a peppered digest is stored. Revocation is immediate and idempotent;
rotation revokes the old secret in the same transaction.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.identity.api_keys.utils import APIKeyUtils
from apps.identity.choices import SecurityEventType
from apps.identity.constants.permissions import CredentialPermissions
from apps.identity.models import ApiKey, PersonalAccessToken
from apps.identity.services.security_event import SecurityEventService

SCOPE_PATTERN = re.compile(r"^[a-z0-9_]+(\.[a-z0-9_]+)+$")

MAX_SCOPES = 50


@dataclass(frozen=True)
class CredentialKind:
    key: str
    label: str
    model: Any
    hash_field: str
    owner_field: str  # attribute holding the acting principal (for PATs)


API_KEY = CredentialKind("api_key", "API key", ApiKey, "hashed_key", "owner")
PERSONAL_ACCESS_TOKEN = CredentialKind(
    "personal_access_token",
    "Personal access token",
    PersonalAccessToken,
    "hashed_token",
    "user",
)

KINDS = {kind.key: kind for kind in (API_KEY, PERSONAL_ACCESS_TOKEN)}


class CredentialService:
    # ------------------------------------------------------------------
    # Access
    # ------------------------------------------------------------------

    @classmethod
    def can_manage_all(cls, user) -> bool:
        if getattr(user, "is_superuser", False):
            return True

        from apps.identity.services.permission_cache import PermissionCacheService

        return PermissionCacheService.has_permission(
            user=user,
            permission=CredentialPermissions.MANAGE,
        )

    @classmethod
    def queryset(cls, kind: CredentialKind, user, *, include_all: bool = False):
        """Credentials ``user`` may see: their own, or every one for a manager."""

        qs = kind.model.objects.all()

        if include_all and cls.can_manage_all(user):
            return qs.select_related()

        if kind is API_KEY:
            return ApiKey.objects.for_principal(user)

        return qs.filter(user=user)

    @classmethod
    def _is_principal(cls, credential, user) -> bool:
        principal = credential.principal

        return principal is not None and principal.pk == user.pk

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    @classmethod
    def validate_scopes(cls, *, owner, scopes) -> list[str]:
        if not isinstance(scopes, (list, tuple)) or not scopes:
            raise ValidationError("Choose at least one scope.")

        cleaned = sorted({str(scope).strip() for scope in scopes})

        if len(cleaned) > MAX_SCOPES:
            raise ValidationError(f"At most {MAX_SCOPES} scopes are allowed.")

        from apps.identity.services.permission_cache import PermissionCacheService

        for scope in cleaned:
            if not SCOPE_PATTERN.match(scope):
                raise ValidationError(f"'{scope}' is not a valid permission code.")

            # A credential can never be granted more than its owner holds.
            if not getattr(owner, "is_superuser", False) and not (
                PermissionCacheService.has_permission(user=owner, permission=scope)
            ):
                raise ValidationError(f"You do not hold '{scope}'.")

        return cleaned

    @classmethod
    def _validate_expiry(cls, expires_at):
        if expires_at is not None and expires_at <= timezone.now():
            raise ValidationError("The expiry must be in the future.")

    @classmethod
    def _live(cls, kind: CredentialKind, owner):
        return cls.queryset(kind, owner).filter(
            is_active=True,
            revoked_at__isnull=True,
        )

    # ------------------------------------------------------------------
    # Create / rotate / revoke
    # ------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def create(
        cls,
        *,
        kind: CredentialKind,
        owner,
        name: str,
        scopes,
        expires_at=None,
        description: str = "",
        rotated_from=None,
    ):
        """
        Mint a credential for ``owner``. Returns ``(credential, token)``; the
        token is the only time the secret exists.
        """

        name = (name or "").strip()

        if not name or len(name) > 255:
            raise ValidationError("A name of 1-255 characters is required.")

        cls._validate_expiry(expires_at)

        cleaned = cls.validate_scopes(owner=owner, scopes=scopes)

        limit = getattr(settings, "IDENTITY_MAX_ACTIVE_CREDENTIALS", 50)

        if rotated_from is None and cls._live(kind, owner).count() >= limit:
            raise ValidationError(
                f"You already have {limit} active {kind.label}s; revoke one first.",
            )

        generated = APIKeyUtils.generate()

        fields: dict[str, Any] = {
            "name": name,
            "prefix": generated["prefix"],
            kind.hash_field: generated["hashed"],
            "scopes": cleaned,
            "expires_at": expires_at,
        }

        if kind is API_KEY:
            fields.update(owner=owner, created_by=owner, description=description[:1000])
        else:
            fields.update(user=owner)

        credential = kind.model.objects.create(**fields)

        metadata = {
            "kind": kind.key,
            "credential_id": str(credential.pk),
            "prefix": credential.prefix,
        }

        if rotated_from is not None:
            metadata["rotated_from"] = str(rotated_from.pk)

        SecurityEventService.create(
            user=owner,
            event_type=SecurityEventType.API_KEY_CREATED,
            description=f"{kind.label} created.",
            metadata=metadata,
        )

        return credential, generated["token"]

    @classmethod
    @transaction.atomic
    def revoke(cls, *, kind: CredentialKind, credential, actor, reason: str = "revoked"):
        """
        Revoke ``credential`` now. Idempotent: revoking again changes nothing
        and records nothing.
        """

        if not cls._is_principal(credential, actor) and not cls.can_manage_all(actor):
            raise PermissionDenied("You cannot revoke this credential.")

        locked = kind.model.objects.select_for_update().get(pk=credential.pk)

        if locked.revoked_at is not None:
            return locked

        locked.is_active = False
        locked.revoked_at = timezone.now()
        locked.save(update_fields=["is_active", "revoked_at", "updated_at"])

        owner = locked.principal

        SecurityEventService.create(
            user=owner,
            event_type=SecurityEventType.API_KEY_REVOKED,
            description=f"{kind.label} revoked.",
            metadata={
                "kind": kind.key,
                "credential_id": str(locked.pk),
                "prefix": locked.prefix,
                "reason": reason,
                "revoked_by": str(actor.pk),
            },
        )

        return locked

    @classmethod
    @transaction.atomic
    def rotate(cls, *, kind: CredentialKind, credential, actor):
        """
        Replace a credential: revoke the old secret and mint a new one with
        the same name, scopes and expiry. Only the owner can rotate (an admin
        could otherwise read the new secret and act as the owner).
        """

        if not cls._is_principal(credential, actor):
            raise PermissionDenied("Only the owner can rotate a credential.")

        locked = kind.model.objects.select_for_update().get(pk=credential.pk)

        if not locked.is_active or locked.revoked_at is not None:
            raise ValidationError("Only an active credential can be rotated.")

        new, token = cls.create(
            kind=kind,
            owner=actor,
            name=locked.name,
            scopes=locked.scopes,
            expires_at=locked.expires_at,
            description=getattr(locked, "description", ""),
            rotated_from=locked,
        )

        cls.revoke(kind=kind, credential=locked, actor=actor, reason="rotated")

        return new, token
