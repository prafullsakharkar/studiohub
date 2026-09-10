"""
Organization selectors.
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet

from apps.organization.models import Organization

from .base import OrganizationBaseSelector


class OrganizationSelector(OrganizationBaseSelector):
    """
    Read-only queries for Organization.
    """

    # Frontend-contract compat: studiohub-react mock dataset identifiers
    # (``src/mocks/db/organization/organization.ts``) use stable string ids
    # (``org-apex-01`` …) while the backend primary key is a UUID. The nested
    # API (``/api/organizations/<org>/…``) documents ``<org>`` as id/code/slug,
    # but the frontend sends its active organization ``id`` — which is the
    # mock id until it refetches organizations from the real API. Map the
    # known mock ids to their canonical codes so those requests resolve
    # instead of 404ing. Seeded by ``seed_studiohub`` from the same mocks.
    FRONTEND_MOCK_ID_TO_CODE: dict[str, str] = {
        "org-apex-01": "APEX",
        "org-vanguard-02": "VNG",
        "org-weta-03": "WETA",
        "org-framestore-04": "FSP",
    }

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Organization]:
        """
        Return the base queryset for Organization.
        """

        return Organization.objects.alive().select_related(
            "created_by",
            "updated_by",
        )

    @classmethod
    def get_by_uuid(cls, uuid):
        """
        Return an organization by UUID.

        ``uuid`` is a property alias for the ``id`` primary key field;
        lookup must target the real column.
        """

        return cls.get_queryset().get(id=uuid)

    @classmethod
    def get_by_code(cls, code):
        """
        Return an organization by code.
        """

        return cls.get_queryset().get(code=code)

    @classmethod
    def resolve_by_lookup(cls, lookup: Any) -> Organization | None:
        """
        Resolve an organization from a URL/header reference.

        Accepts UUID primary key, ``code``, or ``slug`` (case-insensitive),
        plus studiohub-react mock-dataset ids (``org-apex-01`` …) as a
        frontend-contract compat alias. Returns ``None`` when unresolvable
        instead of raising, so callers can 404 with their own message.
        Soft-deleted organizations never resolve.
        """
        if lookup is None:
            return None
        # Request objects may already carry a resolved instance.
        if isinstance(lookup, Organization):
            return lookup if not lookup.is_deleted else None
        text = str(lookup).strip()
        if not text:
            return None
        qs = cls.get_queryset()
        # 1. UUID primary key.
        hit: Any = None
        try:
            hit = qs.filter(id=text).first()
        except (ValueError, TypeError, Exception):
            hit = None
        if hit is not None:
            return hit
        # 2. Canonical code / slug (case-insensitive).
        hit = qs.filter(Q(code__iexact=text) | Q(slug__iexact=text)).first()
        if hit is not None:
            return hit
        # 3. Frontend mock-id compat (explicit map).
        code = cls.FRONTEND_MOCK_ID_TO_CODE.get(text.lower())
        if code:
            hit = qs.filter(code__iexact=code).first()
            if hit is not None:
                return hit
        # 4. Best-effort mock-id shape: ``org-<token>-<nn>`` where the token
        # is a slug/code fragment (e.g. ``org-vanguard-02`` → ``vanguard`` in
        # ``vanguard-vfx``). First match wins; membership/permission checks
        # downstream still gate access, so a wrong guess fails closed.
        token = cls._mock_id_token(text)
        if token:
            hit = qs.filter(
                Q(slug__icontains=token) | Q(code__icontains=token)
            ).first()
            if hit is not None:
                return hit
        return None

    @staticmethod
    def _mock_id_token(text: str) -> str:
        lowered = text.strip().lower()
        if not lowered.startswith("org-"):
            return ""
        body = lowered[4:]
        # Strip trailing numeric suffix (``-01``, ``-04`` …).
        head, sep, tail = body.rpartition("-")
        if sep and tail.isdigit():
            body = head
        # Tokens shorter than 3 chars match too broadly; skip them.
        return body if len(body) >= 3 else ""
