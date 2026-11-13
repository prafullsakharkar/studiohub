"""
Review media reads (docs/review-pipeline/CONTRACTS.md C-RP-19, C-RP-21).

A row is read through its version: whoever reads the version (``GET versions/{id}/``'s narrowing,
client and vendor members included) reads its review media, and nobody else.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from uuid import UUID

from django.db.models import Prefetch, QuerySet

from apps.production.models import ReviewMedia, Version
from apps.production.selectors.base import ProductionBaseSelector

#: rows a version's shape can show (``review_media`` and ``review_media_job``)
_SHOWN = (
    ReviewMedia.Status.QUEUED,
    ReviewMedia.Status.PROCESSING,
    ReviewMedia.Status.READY,
    ReviewMedia.Status.FAILED,
)
PREFETCH_ATTR = "_review_media_rows"


class ReviewMediaSelector(ProductionBaseSelector):
    @staticmethod
    def prefetch() -> Prefetch:  # pyright: ignore[reportMissingTypeArgument]
        """Prefetch for version querysets: the rows ``current`` and ``job`` choose from."""
        return Prefetch(
            "review_media",
            queryset=ReviewMedia.objects.filter(status__in=_SHOWN)
            .select_related("created_by", "created_by__profile")
            .order_by("-queued_at", "-id"),
            to_attr=PREFETCH_ATTR,
        )

    @staticmethod
    def _rows(version: Version) -> list[ReviewMedia]:
        rows = getattr(version, PREFETCH_ATTR, None)
        if rows is None:
            rows = list(
                ReviewMedia.objects.filter(version=version, status__in=_SHOWN)
                .select_related("created_by", "created_by__profile")
                .order_by("-queued_at", "-id")
            )
        return rows

    @classmethod
    def current(cls, version: Version) -> ReviewMedia | None:
        """The version's ready row, or ``None``."""
        return next((r for r in cls._rows(version) if r.status == ReviewMedia.Status.READY), None)

    @classmethod
    def job(cls, version: Version) -> ReviewMedia | None:
        """The newest row when it is not ready yet (queued, processing or failed), or ``None``."""
        rows = cls._rows(version)
        newest = rows[0] if rows else None
        return newest if newest is not None and newest.status != ReviewMedia.Status.READY else None

    @staticmethod
    def for_version(version: Version) -> QuerySet[ReviewMedia]:
        """Every row of ``version``, newest first."""
        return (
            ReviewMedia.objects.filter(version=version)
            .select_related("created_by", "created_by__profile")
            .order_by("-queued_at", "-id")
        )

    @classmethod
    def readable_versions(cls, user: Any) -> QuerySet[Version]:
        """The live versions ``user`` reads, narrowed as ``GET versions/`` narrows them."""
        return cls.scope_by_project_membership(
            Version.objects.all(), request=SimpleNamespace(user=user)
        )

    @classmethod
    def resolve_for(cls, user: Any, media_id: Any) -> ReviewMedia | None:
        """The row with this id when ``user`` reads its live version; ``None`` otherwise (one 404)."""
        try:
            pk = UUID(str(media_id))
        except ValueError:
            return None
        return (
            ReviewMedia.objects.select_related("version", "project")
            .filter(pk=pk, version__in=cls.readable_versions(user))
            .first()
        )
