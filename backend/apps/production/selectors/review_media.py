"""
Review media reads (docs/review-pipeline/CONTRACTS.md C-RP-19, C-RP-21; C-RP-38, RP-14; C-RP-40, RP-15).

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
from apps.production.transcode import colour
from apps.production.transcode import sequence as frames

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
    def colour_target(
        project: Any, *, kind: str, container: str, color_space: str
    ) -> tuple[colour.Target | None, str | None]:
        """
        The colour transform a copy is made with now (C-RP-40), or ``None`` and why not.

        The input is the colour space the upload named, else the project's ``color_space`` for EXR
        frames (scene-linear), else none: movies and other frames are shown as stored (Q-RP-69).
        Why not: ``None`` when nothing is to be transformed, ``unknown_colour_space`` when the config
        does not know the input, view or look, ``colour_config_unavailable`` when it cannot be read.
        """
        name = color_space.strip()
        if not name and kind == ReviewMedia.Kind.SEQUENCE:
            frame_format = frames.FORMATS.get(container)
            if frame_format is not None and frame_format.linear:
                name = (project.color_space or "").strip()
        if not name:
            return None, None
        try:
            return colour.target(name, project.review_view or "", project.review_look or ""), None
        except colour.UnknownColour:
            return None, "unknown_colour_space"
        except colour.ColourUnavailable:
            return None, "colour_config_unavailable"

    @staticmethod
    def colour_options() -> dict[str, Any]:
        """``GET review-media/colour/`` (C-RP-39); ``available`` false when the config cannot be read."""
        try:
            return {"available": True, **colour.options()}
        except colour.ColourUnavailable:
            return {
                "available": False, "config": None, "display": None, "default_view": None,
                "views": [], "looks": [], "color_spaces": [],
            }  # fmt: skip

    @classmethod
    def differing(cls, project: Any) -> QuerySet[ReviewMedia]:
        """
        The ready copies of ``project``'s live versions made with other settings than it has now.

        Burn-ins (C-RP-38): movie and sequence copies whose burn-ins are not ``review_burn_ins``; a
        row without ``burn_ins`` counts as without, and stills never carry burn-ins. Colour (C-RP-40):
        any copy whose ``probe.ocio`` is not the transform it would be made with now; a row without
        ``ocio`` counts as made without one.
        """
        with_burn_ins = Q(probe__burn_ins=True)
        # spelled out: a negated key lookup would drop the rows made before RP-12, which lack the key
        without = Q(probe__isnull=True) | ~Q(probe__has_key="burn_ins") | Q(probe__burn_ins=False)
        live = cls._live_copies(project)
        burn_ins = live.filter(kind__in=(ReviewMedia.Kind.MOVIE, ReviewMedia.Kind.SEQUENCE)).filter(
            without if project.review_burn_ins else with_burn_ins
        )
        colour_ids = cls._colour_differing(project, live)
        return live.filter(Q(pk__in=burn_ins.values("pk")) | Q(pk__in=colour_ids)).order_by(
            "queued_at", "id"
        )

    @staticmethod
    def _live_copies(project: Any) -> QuerySet[ReviewMedia]:
        return ReviewMedia.objects.filter(
            project_id=project.pk,
            status=ReviewMedia.Status.READY,
            version__is_deleted=False,
        )

    @classmethod
    def _colour_differing(cls, project: Any, live: QuerySet[ReviewMedia]) -> list[Any]:
        """
        The ids of ``live`` copies whose ``probe.ocio`` is not what they would be made with now.

        While the config cannot be read, what a copy would be made with is not known, so no copy
        counts: a passing outage must not offer to remake managed copies without their transform.
        """
        targets: dict[tuple[str, str, str], tuple[dict[str, str] | None, str | None]] = {}
        ids = []
        for row_id, kind, container, named, probe in live.values_list(
            "pk", "kind", "source_container", "color_space", "probe"
        ):
            key = (kind, container, named)
            if key not in targets:
                made, why = cls.colour_target(
                    project, kind=kind, container=container, color_space=named
                )
                targets[key] = (made.as_json() if made is not None else None, why)
            target, why = targets[key]
            if why == "colour_config_unavailable":
                continue
            recorded = probe.get("ocio") if isinstance(probe, dict) else None
            if recorded != target:
                ids.append(row_id)
        return ids

    @classmethod
    def copies_summary(cls, project: Any) -> dict[str, Any]:
        """``GET projects/{id}/review-copies/`` (C-RP-38; colour, C-RP-40)."""
        kinds = list(cls.differing(project).values_list("kind", flat=True))
        sequences = kinds.count(ReviewMedia.Kind.SEQUENCE)
        return {
            "review_burn_ins": bool(project.review_burn_ins),
            "out_of_date": len(kinds) - sequences,
            "sequences_out_of_date": sequences,
            # RP-15: how many of them (sequences included) differ in colour, burn-ins aside
            "colour_out_of_date": len(cls._colour_differing(project, cls._live_copies(project))),
        }
