"""
Review media reads (docs/review-pipeline/CONTRACTS.md C-RP-19, C-RP-21; C-RP-38, RP-14).

A row is read through its version: whoever reads the version (``GET versions/{id}/``'s narrowing,
client and vendor members included) reads its review media, and nobody else.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from uuid import UUID

from django.db.models import Prefetch, Q, QuerySet

from apps.production.models import ReviewMedia, Version
from apps.production.selectors.base import ProductionBaseSelector

#: rows a version's shape can show (``review_media`` and ``review_media_job``)
_SHOWN = (
    ReviewMedia.Status.UPLOADING,
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
        """The newest row when it is not ready yet (uploading, queued, processing or failed), or ``None``."""
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

    @staticmethod
    def differing(project: Any) -> QuerySet[ReviewMedia]:
        """
        The ready movie and sequence copies of ``project``'s live versions whose burn-ins are not
        its ``review_burn_ins`` (C-RP-38). A row without ``burn_ins`` counts as without; stills never
        carry burn-ins and are left out.
        """
        with_burn_ins = Q(probe__burn_ins=True)
        # spelled out: a negated key lookup would drop the rows made before RP-12, which lack the key
        without = Q(probe__isnull=True) | ~Q(probe__has_key="burn_ins") | Q(probe__burn_ins=False)
        return (
            ReviewMedia.objects.filter(
                project_id=project.pk,
                status=ReviewMedia.Status.READY,
                kind__in=(ReviewMedia.Kind.MOVIE, ReviewMedia.Kind.SEQUENCE),
                version__is_deleted=False,
            )
            .filter(without if project.review_burn_ins else with_burn_ins)
            .order_by("queued_at", "id")
        )

    @classmethod
    def copies_summary(cls, project: Any) -> dict[str, Any]:
        """``GET projects/{id}/review-copies/`` (C-RP-38)."""
        kinds = list(cls.differing(project).values_list("kind", flat=True))
        sequences = kinds.count(ReviewMedia.Kind.SEQUENCE)
        return {
            "review_burn_ins": bool(project.review_burn_ins),
            "out_of_date": len(kinds) - sequences,
            "sequences_out_of_date": sequences,
        }
