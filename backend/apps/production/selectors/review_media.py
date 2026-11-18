"""
Review media reads (docs/review-pipeline/CONTRACTS.md C-RP-19, C-RP-21; C-RP-38, RP-14; C-RP-40, RP-15;
C-RP-53, RP-20).

A row is read through its version: whoever reads the version (``GET versions/{id}/``'s narrowing,
client and vendor members included) reads its review media, and nobody else.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from uuid import UUID

from django.conf import settings
from django.db.models import Prefetch, Q, QuerySet

from apps.production.models import ReviewMedia, Version
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.transcode import colour
from apps.production.transcode import sequence as frames
from apps.production.validators import review_source

# RP-16 (C-RP-42, Q-RP-75): how many differing copies the copies read lists.
DIFFERING_LIMIT = 100

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
    def grade_for(
        project: Any, shot_grade: Any, *, managed: bool
    ) -> tuple[dict[str, Any] | None, str | None]:
        """
        The grade a copy is made with now (RP-20, C-RP-53), or ``None`` and why not.

        Only a colour-managed copy (``managed``: it has an OpenColorIO transform) of a shot with a
        grade gets it, and only while the project's ``review_grades`` is on (Q-RP-95). Why not:
        ``None`` when it gets none, ``no_grading_space`` when the config has no log ``color_timing``
        space to apply it in (Q-RP-94), ``colour_config_unavailable`` when the config cannot be read.
        """
        if not managed or not project.review_grades or not shot_grade:
            return None, None
        try:
            space = colour.grading_space()
        except colour.ColourUnavailable:
            return None, "colour_config_unavailable"
        return (shot_grade, None) if space else (None, "no_grading_space")

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
        The ready copies of ``project``'s live versions made with other settings than it has now,
        oldest first (C-RP-38, C-RP-40, C-RP-43); see ``differences``.
        """
        return (
            cls._live_copies(project)
            .filter(pk__in=list(cls.differences(project)))
            .order_by("queued_at", "id")
        )

    @classmethod
    def differences(cls, project: Any) -> dict[Any, list[str]]:
        """
        Each differing copy's id and why: ``burn_ins``, ``colour`` and/or ``grade``.

        Burn-ins (C-RP-38): movie and sequence copies whose burn-ins are not ``review_burn_ins``; a
        row without ``burn_ins`` counts as without, and stills never carry burn-ins. Colour (C-RP-40):
        any copy whose ``probe.ocio`` is not the transform it would be made with now; a row without
        ``ocio`` counts as made without one. Grade (RP-20, C-RP-53): any copy whose ``probe.grade`` is
        not the grade it would be made with now; a row without ``grade`` counts as made without one. A
        copy kept as it is against the settings the project has now does not differ (C-RP-43).
        """
        with_burn_ins = Q(probe__burn_ins=True)
        # spelled out: a negated key lookup would drop the rows made before RP-12, which lack the key
        without = Q(probe__isnull=True) | ~Q(probe__has_key="burn_ins") | Q(probe__burn_ins=False)
        live = cls._live_copies(project)
        kept = set(cls._kept_matching(project, live))
        burn_ins = set(
            live.filter(kind__in=(ReviewMedia.Kind.MOVIE, ReviewMedia.Kind.SEQUENCE))
            .filter(without if project.review_burn_ins else with_burn_ins)
            .values_list("pk", flat=True)
        )
        why: dict[Any, list[str]] = {}
        for row_id in burn_ins - kept:
            why.setdefault(row_id, []).append("burn_ins")
        colour_ids, grade_ids = cls._colour_differing(project, live)
        for row_id in set(colour_ids) - kept:
            why.setdefault(row_id, []).append("colour")
        for row_id in set(grade_ids) - kept:
            why.setdefault(row_id, []).append("grade")
        return why

    @staticmethod
    def _live_copies(project: Any) -> QuerySet[ReviewMedia]:
        return ReviewMedia.objects.filter(
            project_id=project.pk,
            status=ReviewMedia.Status.READY,
            version__is_deleted=False,
        )

    @classmethod
    def _colour_differing(
        cls, project: Any, live: QuerySet[ReviewMedia]
    ) -> tuple[list[Any], list[Any]]:
        """
        The ids of ``live`` copies whose ``probe.ocio`` is not what they would be made with now, and
        of those whose ``probe.grade`` is not (RP-20).

        While the config cannot be read, what a copy would be made with is not known, so no copy
        counts: a passing outage must not offer to remake managed copies without their transform.
        """
        targets: dict[tuple[str, str, str], tuple[dict[str, str] | None, str | None]] = {}
        colour_ids, grade_ids = [], []
        for row_id, kind, container, named, probe, shot_grade in live.values_list(
            "pk", "kind", "source_container", "color_space", "probe", "version__shot__grade"
        ):
            target, why = cls._target_json(project, targets, kind, container, named)
            if why == "colour_config_unavailable":
                continue
            recorded = probe if isinstance(probe, dict) else {}
            if recorded.get("ocio") != target:
                colour_ids.append(row_id)
            grade, why = cls.grade_for(project, shot_grade, managed=target is not None)
            if why != "colour_config_unavailable" and recorded.get("grade") != grade:
                grade_ids.append(row_id)
        return colour_ids, grade_ids

    @classmethod
    def _target_json(
        cls,
        project: Any,
        cache: dict[tuple[str, str, str], tuple[dict[str, str] | None, str | None]],
        kind: str,
        container: str,
        named: str,
    ) -> tuple[dict[str, str] | None, str | None]:
        key = (kind, container, named)
        if key not in cache:
            made, why = cls.colour_target(
                project, kind=kind, container=container, color_space=named
            )
            cache[key] = (made.as_json() if made is not None else None, why)
        return cache[key]

    @classmethod
    def _kept_matching(cls, project: Any, live: QuerySet[ReviewMedia]) -> list[Any]:
        """The ids of ``live`` copies kept as they are against the settings ``project`` has now."""
        cache: dict[tuple[str, str, str], tuple[dict[str, str] | None, str | None]] = {}
        ids = []
        for row_id, kind, container, named, kept, shot_grade in live.filter(
            kept_for__isnull=False
        ).values_list(
            "pk", "kind", "source_container", "color_space", "kept_for", "version__shot__grade"
        ):
            if not isinstance(kept, dict) or kept.get("burn_ins") != bool(project.review_burn_ins):
                continue
            target, why = cls._target_json(project, cache, kind, container, named)
            # while the config cannot be read colour does not count (above), so neither does it here
            if why == "colour_config_unavailable":
                ids.append(row_id)
                continue
            # RP-20: a copy kept before grades counts as kept without one
            grade, _ = cls.grade_for(project, shot_grade, managed=target is not None)
            if kept.get("ocio") == target and kept.get("grade") == grade:
                ids.append(row_id)
        return ids

    @classmethod
    def settings_now(cls, project: Any, row: ReviewMedia) -> dict[str, Any] | None:
        """What ``row`` would be made with now (``kept_for``, C-RP-43); ``None`` if the config is unreadable."""
        made, why = cls.colour_target(
            project, kind=row.kind, container=row.source_container, color_space=row.color_space
        )
        if why == "colour_config_unavailable":
            return None
        shot = row.version.shot if row.version.shot_id else None  # pyright: ignore[reportAttributeAccessIssue]
        grade, _ = cls.grade_for(project, getattr(shot, "grade", None), managed=made is not None)
        return {
            "burn_ins": bool(project.review_burn_ins),
            "ocio": made.as_json() if made is not None else None,
            "grade": grade,
        }

    @staticmethod
    def remakable(row: ReviewMedia) -> bool:
        """Whether ``row`` can be remade: a movie or still with its upload, a sequence with its frames,
        a copy read from a published file while that file can still be read (RP-17, C-RP-46), a copy
        read by path while it is still in the project's review folder (RP-18, C-RP-49)."""
        if row.source == "published_file":
            return row.from_storage and (
                row.storage_root.upper() in settings.PUBLISHING_STORAGE_MOUNTS
            )
        if row.source == "storage_path":
            return review_source.path_still_readable(
                row.version.project, row.storage_root, row.storage_path
            )
        if row.kind == ReviewMedia.Kind.SEQUENCE:
            return row.frames_kept
        return bool(row.source_path)

    @classmethod
    def differing_list(
        cls, project: Any, why: dict[Any, list[str]]
    ) -> tuple[list[dict[str, Any]], int]:
        """The first ``DIFFERING_LIMIT`` differing copies, oldest first, and how many more (C-RP-42)."""
        rows = list(
            cls._live_copies(project)
            .filter(pk__in=list(why))
            .select_related("version", "version__shot", "version__asset", "version__project")
            .order_by("queued_at", "id")[:DIFFERING_LIMIT]
        )
        listed = []
        for row in rows:
            version = row.version
            record = version.shot or version.asset
            listed.append(
                {
                    "review_media_id": row.pk,
                    "kind": row.kind,
                    "version": {"id": version.pk, "code": version.code},
                    "record_code": getattr(record, "code", "") or version.entity_code or "",
                    "remakable": cls.remakable(row),
                    "frames_until": row.frames_until if row.frames_kept else None,
                    # RP-17 (C-RP-46): the published file the copy was read from, or null
                    "published_file_id": row.published_file_id,
                    # RP-18 (C-RP-49): upload, published_file or storage_path
                    "source": row.source,
                    "why": why[row.pk],
                }
            )
        return listed, max(0, len(why) - len(listed))

    @classmethod
    def copies_summary(cls, project: Any) -> dict[str, Any]:
        """``GET projects/{id}/review-copies/`` (C-RP-38; colour, C-RP-40)."""
        why = cls.differences(project)
        kinds = list(
            cls._live_copies(project).filter(pk__in=list(why)).values_list("kind", flat=True)
        )
        sequences = kinds.count(ReviewMedia.Kind.SEQUENCE)
        differing, more = cls.differing_list(project, why)
        return {
            "review_burn_ins": bool(project.review_burn_ins),
            "out_of_date": len(kinds) - sequences,
            "sequences_out_of_date": sequences,
            # RP-15: how many of them (sequences included) differ in colour, burn-ins aside
            "colour_out_of_date": sum("colour" in reasons for reasons in why.values()),
            # RP-20 (C-RP-53): how many differ in their grade
            "review_grades": bool(project.review_grades),
            "grade_out_of_date": sum("grade" in reasons for reasons in why.values()),
            # RP-16 (C-RP-42): which ones, the oldest first
            "differing": differing,
            "differing_more": more,
        }
