"""
Review media: upload a movie, a still or an image sequence to a version, process it, retry, remove
(docs/review-pipeline/CONTRACTS.md C-RP-19, C-RP-20, C-RP-22; ADR-0040; C-RP-31 to C-RP-33, RP-12).

Upload, the sequence's parts, retry and remove run in the request; ``process`` runs in the
``celery-media`` worker, which has ffmpeg. Files live under ``MEDIA_ROOT/<row.directory>/``: a movie
or still as ``source.<ext>``, a sequence's frames as ``source/frame.<8 digits>.<ext>``, and the
results as ``proxy.mp4`` (``proxy.jpg`` for a still), ``thumbnail.jpg`` and ``filmstrip.jpg``. A row
that is superseded or removed loses its folder once the change is committed. A sequence keeps its
frames for ``REVIEW_MEDIA_SEQUENCE_KEEP_DAYS`` once its copy is ready (``frames_until``), then the sweep
deletes them (RP-16, C-RP-41; with 0 they go at once, as Q-RP-56 had it). A remake (RP-14, C-RP-37;
sequences, RP-16) is a new row whose upload is a hard link to the kept upload, or to each kept frame, of
the ready copy it remakes, so superseding that copy later cannot delete it.

A copy made from a registered published file (RP-17, C-RP-44 to C-RP-46; ADR-0042) has no upload.
Its row names the file's storage root and relative path. For each job the worker makes
``source.<ext>``, or ``source/frame.<8 digits>.<ext>`` per frame, as symbolic links to the file's
real location. Each link is resolved under the root's directory in ``PUBLISHING_STORAGE_MOUNTS``,
refused outside it, and checked by its leading bytes. The links are removed when the job ends.
Nothing is ever written under a root, and logs never carry a path.
"""

from __future__ import annotations

import dataclasses
import hashlib
import os
import shutil
import subprocess
import time
import uuid
from datetime import timedelta
from pathlib import Path
from typing import Any

import structlog
from celery.exceptions import SoftTimeLimitExceeded
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.core.events import default_event_bus
from apps.core.utils.client_ip import get_client_ip
from apps.core.utils.paths import PathRuleError, frame_file_name, is_sequence_pattern, resolve_mount
from apps.production.events.review_media import ReviewMediaFinished
from apps.production.exceptions import ReviewMediaBusy, ReviewMediaDisabled
from apps.production.models import Project, ReviewMedia, Shot, Version
from apps.production.selectors.review_media import ReviewMediaSelector
from apps.production.services import review_media_links
from apps.production.transcode import colour, detect
from apps.production.transcode import ffmpeg as commands
from apps.production.transcode import sequence as frames
from apps.production.validators import review_source
from apps.production.validators.colour import validate_upload_colour

logger = structlog.get_logger(__name__)

Status = ReviewMedia.Status
Code = ReviewMedia.ErrorCode

#: a row left in ``processing`` this long was dropped by its worker
STALE_PROCESSING = timedelta(minutes=45)
#: a row still ``queued`` this long lost its message (the broker was emptied)
STALE_QUEUED = timedelta(hours=24)
#: a sequence ``uploading`` with no part for this long was abandoned (C-RP-31)
STALE_UPLOADING = timedelta(hours=24)
#: the whole job's budget, shared by its commands (the task's soft limit is a little longer)
JOB_BUDGET_SECONDS = commands.TRANSCODE_TIMEOUT_SECONDS
#: baked colour LUTs, under the review media folder (RP-15): one per transform, shared by jobs
LUT_FOLDER = "luts"

_CHUNK = 1024 * 1024
_LOG_TAIL = 2000
#: why a copy has no slate although its project asks for one (RP-25, ``probe.slate_skipped``)
SLATE_FAILED = "slate_failed"
SLATE_FONT_MISSING = "font_missing"


class _Failed(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


#: the processing task; ``CELERY_TASK_ROUTES`` sends it to the ``media`` queue
PROCESS_TASK = "production.process_review_media"
#: deletes a row's folder where the media volume is mounted (the sweep's worker has none)
DISCARD_TASK = "production.discard_review_media"


def _publish_finished(row: ReviewMedia) -> None:
    """``ReviewMediaFinished`` for a row that just became ``ready`` or ``failed`` (RP-6, C-RP-24)."""
    default_event_bus.publish(
        ReviewMediaFinished(
            review_media_id=str(row.pk),
            version_id=str(row.version_id),  # pyright: ignore[reportAttributeAccessIssue]
            project_id=str(row.project_id),  # pyright: ignore[reportAttributeAccessIssue]
            status=row.status,
            error_code=row.error_code or "",
            created_by_id=str(row.created_by_id) if row.created_by_id else None,  # pyright: ignore[reportAttributeAccessIssue]
            remake=row.remake_of_id is not None,  # pyright: ignore[reportAttributeAccessIssue]
        )
    )


def enqueue(media_id: Any) -> None:
    """Queue the processing job; called once the upload or retry is committed.

    Sent by name through the project's Celery app (``core.celery``). The web process loads that app
    nowhere else, and Celery's default app knows neither the broker nor the routes, so a
    ``shared_task.delay()`` from a request would not reach the ``media`` worker.
    """
    from core.celery import app

    # The task keeps no result (``ignore_result``): nothing subscribes to the result backend.
    app.send_task(PROCESS_TASK, args=[str(media_id)], ignore_result=True)


def discard_later(relative: str) -> None:
    """Delete a row's folder from the ``media`` worker (the sweep runs where no media volume is)."""
    from core.celery import app

    app.send_task(DISCARD_TASK, args=[relative], ignore_result=True)


def _media_root() -> Path:
    return Path(settings.MEDIA_ROOT)


def _delete_folder(relative: str) -> None:
    if not relative or not relative.startswith(f"{settings.REVIEW_MEDIA_DIR}/"):
        # never the media root itself (an empty ``source_path``) or anything outside review media
        logger.error("review_media_delete_refused", folder=relative)
        return
    folder = _media_root() / relative
    shutil.rmtree(folder, ignore_errors=True)


def discard_folder(relative: str) -> None:
    """Delete a folder under the review media folder; anything else is refused (``DISCARD_TASK``)."""
    parts = Path(relative).parts
    if (
        len(parts) < 2
        or parts[0] != settings.REVIEW_MEDIA_DIR
        or ".." in parts
        or Path(relative).is_absolute()
    ):
        logger.error("review_media_discard_refused", folder=relative)
        return
    _delete_folder(relative)


def _burn_in(media: ReviewMedia) -> commands.BurnIn | None:
    """What the copy of ``media`` carries burnt in, or ``None`` (C-RP-33: per project; never on a still)."""
    if media.kind == ReviewMedia.Kind.STILL:
        return None
    version = Version.objects.select_related("project", "shot", "asset").get(
        pk=media.version_id  # pyright: ignore[reportAttributeAccessIssue]
    )
    project = version.project
    if not project.review_burn_ins:
        return None
    record = version.shot or version.asset
    record_code = getattr(record, "code", "") or version.entity_code
    if media.kind == ReviewMedia.Kind.SEQUENCE:
        first = media.first_frame or 0
    else:
        first = version.start_frame if version.start_frame is not None else 1
    return commands.BurnIn(
        top_left="  ".join(part for part in (project.code, record_code) if part),
        top_right=version.code,
        # C-RP-37: fixed when the copy is first made, and kept by its remakes
        bottom_left=(media.burn_in_date or timezone.now().date()).isoformat(),
        first_frame=first,
    )


def _slate_lines(media: ReviewMedia, probe: commands.Probe) -> list[str] | None:
    """What the slate before ``media``'s download says, or ``None`` (RP-25, C-RP-59: per project;
    never on a still). Its date is the burn-in date, fixed when the copy is first made (C-RP-37)."""
    if media.kind == ReviewMedia.Kind.STILL:
        return None
    version = Version.objects.select_related("project", "shot", "asset", "task", "artist").get(
        pk=media.version_id  # pyright: ignore[reportAttributeAccessIssue]
    )
    project = version.project
    if not project.review_slates:
        return None
    record = version.shot or version.asset
    if media.kind == ReviewMedia.Kind.SEQUENCE:
        first = media.first_frame or 0
    else:
        first = version.start_frame if version.start_frame is not None else 1
    last = first + max(probe.frames, 1) - 1
    task = version.task
    artist = getattr(version.artist, "display_name", "") if version.artist_id else ""  # pyright: ignore[reportAttributeAccessIssue]
    return [
        "  ".join(part for part in (project.code, project.name) if part),
        getattr(record, "code", "") or version.entity_code,
        version.code,
        f"Task: {task.code}  {task.title}".strip() if task is not None else "",
        f"Artist: {artist}" if artist else "",
        f"Frames {first}-{last} ({probe.frames})  {probe.fps:g} fps",
        f"Made {(media.burn_in_date or timezone.now().date()).isoformat()}",
        project.review_slate_note,
    ]


def _sequence_rate(media: ReviewMedia) -> str:
    fps = Version.objects.filter(pk=media.version_id).values_list("fps", flat=True).first()  # pyright: ignore[reportAttributeAccessIssue]
    return commands.rate_of(fps if fps is not None else 24)


def _audit(
    *,
    actor: Any,
    version: Version,
    operation: str,
    media: ReviewMedia,
    action: str,
    description: str,
) -> None:
    AuditLog.objects.create(
        action=action,
        target_type=AuditLog.TARGET_VERSION,
        target_id=str(version.pk),
        target_name=str(version.code)[:255],
        project_id=version.project_id,  # pyright: ignore[reportAttributeAccessIssue]
        description=description,
        actor_id=getattr(actor, "pk", None),
        metadata={
            "operation": operation,
            "review_media_id": str(media.pk),
            "kind": media.kind,
            "status": media.status,
            "attempts": media.attempts,
        },
    )


def record_download(*, user: Any, media: ReviewMedia, request: Any) -> None:
    """RP-23 (C-RP-57, Q-RP-107): who downloaded which copy, when and from where; one row per download."""
    version = media.version
    name = review_media_links.download_name(media)
    AuditLog.objects.create(
        action=AuditLog.ACTION_EXPORT,
        target_type=AuditLog.TARGET_VERSION,
        target_id=str(version.pk),
        target_name=str(version.code)[:255],
        project_id=version.project_id,  # pyright: ignore[reportAttributeAccessIssue]
        description=f"Downloaded the review copy {name}."[:1000],
        actor_id=getattr(user, "pk", None),
        ip_address=get_client_ip(request) or None,
        metadata={
            "operation": "download",
            "review_media_id": str(media.pk),
            "kind": media.kind,
            "file_name": name,
            # RP-25 (C-RP-59): whether the file had a slate before the copy
            "slate": bool((media.probe or {}).get("slate")),
        },
    )


#: why a copy cannot be remade (C-RP-37), one sentence each
REMAKE_REFUSALS = {
    "sequence": "The frames of this sequence are no longer kept. Upload the frames again.",
    "not_ready": "Only a ready review copy can be remade.",
    "missing": "The uploaded file is no longer on the server. Upload it again.",
    "storage": (
        "The published file of this copy can no longer be read: it was revoked, or the server "
        "no longer reads its storage root."
    ),
    # RP-18 (C-RP-49)
    "storage_path": (
        "The render of this copy can no longer be read: it is not in the project's review folder "
        "any more, or the server no longer reads its storage root."
    ),
}
KEEP_UNAVAILABLE = "The studio's colour config cannot be read, so copies cannot be kept now."


def _keep_frames_until(row: ReviewMedia, now: Any) -> Any:
    """Until when a sequence copy that is now ready keeps its frames, or ``None`` (C-RP-41, Q-RP-74)."""
    days = settings.REVIEW_MEDIA_SEQUENCE_KEEP_DAYS
    if days <= 0:
        return None
    # a remake keeps the original's time; a first copy starts it
    until = row.frames_until or now + timedelta(days=days)
    return until if until > now else None


@dataclasses.dataclass(frozen=True)
class StorageSource:
    """A place on studio storage to read a copy from: a registered published file as publishing
    hands it over (RP-17, C-RP-44), or a render in the project's review folder (RP-18, C-RP-48,
    ``published_file_id`` None)."""

    #: the storage root's code, as in ``PUBLISHING_STORAGE_MOUNTS``
    root: str
    #: the relative path on the root (the folder included); a frame pattern for a sequence
    path: str
    published_file_id: Any
    first_frame: int | None = None
    last_frame: int | None = None


def storage_readable(root: str) -> bool:
    """Whether the servers read storage root ``root`` (Q-RP-78: ``PUBLISHING_STORAGE_MOUNTS``)."""
    return bool(root) and root.upper() in settings.PUBLISHING_STORAGE_MOUNTS


def storage_problem(path: str, first_frame: int | None, last_frame: int | None) -> str | None:
    """Why a copy cannot be read from a file with this path and range, one sentence, or ``None``.

    The worker reads movies and stills as uploads (``detect``) and sequences of the frame formats
    (``sequence``), at most ``REVIEW_MEDIA_MAX_FRAMES`` frames (C-RP-44). Checked before a row is made.
    """
    if not settings.REVIEW_MEDIA_ENABLED:
        return "Review copies are switched off on this server."
    extension = detect.extension_of(path.rsplit("/", 1)[-1])
    if first_frame is not None and last_frame is not None:
        if frames.format_for(extension) is None:
            return f"Frames can be {', '.join(sorted(frames.EXTENSIONS))}; these frames are not."
        if last_frame - first_frame + 1 > settings.REVIEW_MEDIA_MAX_FRAMES:
            return f"A sequence has at most {settings.REVIEW_MEDIA_MAX_FRAMES} frames."
        return None
    if extension not in detect.ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(detect.ALLOWED_EXTENSIONS))
        return f"A review copy is made from a movie, a still ({allowed}) or a sequence of frames."
    return None


def _require_enabled() -> None:
    if not settings.REVIEW_MEDIA_ENABLED:
        raise ReviewMediaDisabled()


def _check_upload(upload: Any) -> detect.Container:
    """The upload's container; a 400 on ``file`` when it may not be processed."""
    size = int(getattr(upload, "size", 0) or 0)
    if size <= 0:
        raise ValidationError({"file": ["The file is empty."]})
    limit = settings.REVIEW_MEDIA_MAX_BYTES
    if size > limit:
        raise ValidationError({"file": [f"The file is larger than {limit // (1024 * 1024)} MB."]})
    upload.seek(0)
    head = upload.read(detect.HEAD_BYTES)
    upload.seek(0)
    try:
        return detect.detect(str(getattr(upload, "name", "") or ""), head)
    except detect.UnknownContainer as error:
        if str(error) == "extension":
            allowed = ", ".join(sorted(detect.ALLOWED_EXTENSIONS))
            raise ValidationError({"file": [f"Upload a movie or a still: {allowed}."]}) from error
        raise ValidationError(
            {"file": ["The file's content does not match its extension."]}
        ) from error


class ReviewMediaService:
    # ------------------------------------------------------------------ request side

    @classmethod
    def upload(
        cls, *, actor: Any, version: Version, upload: Any, color_space: str = ""
    ) -> ReviewMedia:
        """Store ``upload`` for ``version`` and queue its job after commit (C-RP-19; C-RP-40)."""
        _require_enabled()
        color_space = validate_upload_colour(color_space)
        container = _check_upload(upload)
        extension = detect.extension_of(str(upload.name))
        folder: str | None = None
        try:
            with transaction.atomic():
                # One upload at a time per version: the lock orders concurrent uploads.
                Version.objects.select_for_update().filter(pk=version.pk).first()
                if ReviewMedia.objects.filter(
                    version=version, status__in=ReviewMedia.IN_FLIGHT
                ).exists():
                    raise ReviewMediaBusy()
                media = ReviewMedia(
                    project_id=version.project_id,  # pyright: ignore[reportAttributeAccessIssue]
                    version=version,
                    kind=container.kind,
                    status=Status.QUEUED,
                    source_name=str(upload.name).rsplit("/", 1)[-1][:255],
                    source_container=container.key,
                    color_space=color_space,
                    queued_at=timezone.now(),
                    created_by=actor if getattr(actor, "pk", None) else None,
                )
                media.save()
                folder = media.directory
                media.source_path = f"{folder}/source.{extension}"
                media.source_size, media.source_sha256 = cls._store(upload, media.source_path)
                media.save(update_fields=["source_path", "source_size", "source_sha256"])
                _audit(
                    actor=actor,
                    version=version,
                    operation="review_media_upload",
                    media=media,
                    action=AuditLog.ACTION_CREATE,
                    description=f"Review {media.kind} uploaded to version {version.code}.",
                )
                media_id = media.pk
                transaction.on_commit(lambda: enqueue(media_id))
        except IntegrityError as error:
            if folder:
                _delete_folder(folder)
            raise ReviewMediaBusy() from error
        except BaseException:
            if folder:
                _delete_folder(folder)
            raise
        return media

    @staticmethod
    def _store(upload: Any, relative: str) -> tuple[int, str]:
        """Write ``upload`` to ``relative`` under MEDIA_ROOT; its size and SHA-256."""
        target = _media_root() / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        digest, size = hashlib.sha256(), 0
        upload.seek(0)
        with target.open("xb") as handle:
            for chunk in upload.chunks(_CHUNK):
                digest.update(chunk)
                size += len(chunk)
                handle.write(chunk)
        return size, digest.hexdigest()

    @classmethod
    def retry(cls, *, actor: Any, media: ReviewMedia) -> ReviewMedia:
        """Queue a failed row again (C-RP-20)."""
        _require_enabled()
        try:
            with transaction.atomic():
                row = (
                    ReviewMedia.objects.select_for_update()
                    .select_related("version")
                    .get(pk=media.pk)
                )
                if row.status != Status.FAILED:
                    raise ValidationError({"detail": ["Only a failed upload can be retried."]})
                if row.attempts >= ReviewMedia.MAX_ATTEMPTS:
                    raise ValidationError(
                        {
                            "detail": [
                                f"This upload failed {row.attempts} times. Upload the file again."
                            ]
                        }
                    )
                if (
                    ReviewMedia.objects.filter(
                        version_id=row.version_id,  # pyright: ignore[reportAttributeAccessIssue]
                        status__in=ReviewMedia.IN_FLIGHT,
                    )
                    .exclude(pk=row.pk)
                    .exists()
                ):
                    raise ReviewMediaBusy()
                row.status = Status.QUEUED
                row.error_code = ""
                row.queued_at = timezone.now()
                row.started_at = None
                row.finished_at = None
                row.save(
                    update_fields=["status", "error_code", "queued_at", "started_at", "finished_at"]
                )
                _audit(
                    actor=actor,
                    version=row.version,
                    operation="review_media_retry",
                    media=row,
                    action=AuditLog.ACTION_UPDATE,
                    description=f"Review {row.kind} of version {row.version.code} queued again.",
                )
                row_id = row.pk
                transaction.on_commit(lambda: enqueue(row_id))
        except IntegrityError as error:
            raise ReviewMediaBusy() from error
        return row

    # ------------------------------------------------------------------ from studio storage (C-RP-44)

    @classmethod
    def open_from_storage(
        cls, *, actor: Any, version: Version, source: StorageSource, color_space: str = ""
    ) -> ReviewMedia:
        """Queue a copy of ``version`` read from a registered published file (RP-17, C-RP-44).

        Publishing has checked the file (its reach, status, role, checksum and root); this checks what
        the worker can read and queues the job after commit. Nothing is copied: the worker reads the
        file where it lies (``_storage_input``).
        """
        _require_enabled()
        color_space = validate_upload_colour(color_space)
        problem = storage_problem(source.path, source.first_frame, source.last_frame)
        if problem:
            raise ValidationError({"detail": [problem]})
        name = source.path.rsplit("/", 1)[-1]
        extension = detect.extension_of(name)
        sequence = source.first_frame is not None and source.last_frame is not None
        frame_format = frames.format_for(extension) if sequence else None
        container = (
            None
            if sequence
            else next((c for c in detect.CONTAINERS.values() if extension in c.extensions), None)
        )
        try:
            with transaction.atomic():
                Version.objects.select_for_update().filter(pk=version.pk).first()
                if ReviewMedia.objects.filter(
                    version=version, status__in=ReviewMedia.IN_FLIGHT
                ).exists():
                    raise ReviewMediaBusy()
                media = ReviewMedia(
                    project_id=version.project_id,  # pyright: ignore[reportAttributeAccessIssue]
                    version=version,
                    kind=ReviewMedia.Kind.SEQUENCE
                    if sequence
                    else (container.kind if container else ""),
                    status=Status.QUEUED,
                    source_name=(
                        f"{name} [{source.first_frame}-{source.last_frame}]" if sequence else name
                    )[:255],
                    source_container=(frame_format.key if frame_format else "")
                    or (container.key if container else ""),
                    sequence_extension=extension if sequence else "",
                    first_frame=source.first_frame if sequence else None,
                    last_frame=source.last_frame if sequence else None,
                    color_space=color_space,
                    storage_root=source.root.upper(),
                    storage_path=source.path,
                    published_file_id=source.published_file_id,
                    queued_at=timezone.now(),
                    created_by=actor if getattr(actor, "pk", None) else None,
                )
                media.save()
                by_path = source.published_file_id is None
                _audit(
                    actor=actor,
                    version=version,
                    operation="review_media_from_path" if by_path else "review_media_from_storage",
                    media=media,
                    action=AuditLog.ACTION_CREATE,
                    description=(
                        f"Review {media.kind} of version {version.code} queued from "
                        + ("the project's review folder." if by_path else "a published file.")
                    ),
                )
                media_id = media.pk
                transaction.on_commit(lambda: enqueue(media_id))
        except IntegrityError as error:
            raise ReviewMediaBusy() from error
        return media

    @classmethod
    def open_from_path(
        cls,
        *,
        actor: Any,
        version: Version,
        path: Any,
        first_frame: int | None = None,
        last_frame: int | None = None,
        color_space: str = "",
    ) -> ReviewMedia:
        """Queue a copy of ``version`` read from a render in its project's review folder (RP-18,
        C-RP-48). ``path`` is relative to the folder; a frame pattern needs the range (Q-RP-84).

        The version may be unpublished: nothing is registered (Q-RP-82). Every refusal is a 400 on
        one field and never names a directory (Q-RP-86).
        """
        _require_enabled()
        project = version.project
        joined = review_source.full_path(project, path)
        pattern = is_sequence_pattern(joined)
        given = first_frame is not None or last_frame is not None
        if pattern and (first_frame is None or last_frame is None):
            raise ValidationError(
                {"first_frame": ["A frame pattern needs first_frame and last_frame."]}
            )
        if not pattern and given:
            raise ValidationError(
                {"path": ["A frame range needs a frame pattern in the file name (%04d or ####)."]}
            )
        if pattern:
            assert first_frame is not None and last_frame is not None
            if first_frame < 0 or last_frame < first_frame:
                raise ValidationError(
                    {"last_frame": ["The range runs from first_frame up to last_frame, from 0."]}
                )
        problem = storage_problem(joined, first_frame, last_frame)
        if problem:
            raise ValidationError({"path": [problem]})
        root, _folder = review_source.project_folder(project) or ("", "")
        return cls.open_from_storage(
            actor=actor,
            version=version,
            source=StorageSource(
                root=root,
                path=joined,
                published_file_id=None,
                first_frame=first_frame if pattern else None,
                last_frame=last_frame if pattern else None,
            ),
            color_space=color_space,
        )

    @staticmethod
    def forget_storage(published_file_id: Any) -> int:
        """A published file was revoked (C-RP-46, Q-RP-81): copies made from it can no longer read it.

        The copies stay shown, but cannot be remade (they can be kept as they are); a job still to run
        fails with ``storage_unreadable``. Called by publishing inside the revoke's transaction.
        """
        return ReviewMedia.objects.filter(published_file_id=published_file_id).update(
            storage_root="", storage_path=""
        )

    # ------------------------------------------------------------------ remakes (C-RP-37, C-RP-38)

    @classmethod
    def remake(cls, *, actor: Any, media: ReviewMedia) -> ReviewMedia:
        """Queue a new copy of the ready ``media`` from its kept upload or frames (C-RP-37, C-RP-41)."""
        _require_enabled()
        made, problem = cls._remake(actor=actor, media_id=media.pk)
        if problem == "busy":
            raise ReviewMediaBusy()
        if made is None:
            raise ValidationError({"detail": [REMAKE_REFUSALS[problem or "not_ready"]]})
        return made

    @classmethod
    def remake_differing(cls, *, actor: Any, project: Any) -> dict[str, int]:
        """Remake every copy of ``project`` made with other settings than it has now (C-RP-38).

        Movies from their kept upload, sequences while their frames are kept (C-RP-41); a sequence
        whose frames are gone is counted in ``skipped_sequence``. Copies read from a published file
        are read again (C-RP-46); one whose file can no longer be read counts in ``skipped_storage``.
        """
        _require_enabled()
        counts = {
            "queued": 0,
            "skipped_busy": 0,
            "skipped_sequence": 0,
            "skipped_missing": 0,
            "skipped_storage": 0,
        }
        for row_id in ReviewMediaSelector.differing(project).values_list("pk", flat=True):
            made, problem = cls._remake(actor=actor, media_id=row_id)
            if made is not None:
                counts["queued"] += 1
            elif problem == "busy":
                counts["skipped_busy"] += 1
            elif problem == "sequence":
                counts["skipped_sequence"] += 1
            elif problem == "missing":
                counts["skipped_missing"] += 1
            elif problem in ("storage", "storage_path"):  # RP-18 (C-RP-49): either source
                counts["skipped_storage"] += 1
        return counts

    @classmethod
    def keep(cls, *, actor: Any, project: Any, ids: list[Any]) -> dict[str, int]:
        """Keep differing copies that cannot be remade as they are (C-RP-43); all of them or none.

        Each row stores the settings it was kept against (``kept_for``), so it counts again once the
        project's burn-ins, colour space, view or look change.
        """
        with transaction.atomic():
            why = ReviewMediaSelector.differences(project)
            rows = {
                row.pk: row
                for row in ReviewMedia.objects.select_for_update()
                .select_related("version")
                .filter(project_id=project.pk, pk__in=ids)
            }
            problems = []
            for media_id in ids:
                row = rows.get(media_id)
                if row is None or media_id not in why:
                    problems.append(f"{media_id}: this is not a copy of the project that differs.")
                elif ReviewMediaSelector.remakable(row):
                    problems.append(
                        f"{row.version.code}: this copy can be remade; remake it instead."
                    )
            if problems:
                raise ValidationError({"review_media_ids": problems[:10]})
            for row in rows.values():
                kept_for = ReviewMediaSelector.settings_now(project, row)
                if kept_for is None:
                    raise ValidationError({"detail": [KEEP_UNAVAILABLE]})
                row.kept_for = kept_for
                row.save(update_fields=["kept_for"])
                _audit(
                    actor=actor,
                    version=row.version,
                    operation="review_media_kept",
                    media=row,
                    action=AuditLog.ACTION_UPDATE,
                    description=(
                        f"Review {row.kind} of version {row.version.code} kept as it is with the "
                        "project's settings."
                    ),
                )
        return {"kept": len(rows)}

    @classmethod
    def _remake(cls, *, actor: Any, media_id: Any) -> tuple[ReviewMedia | None, str | None]:
        """The new row, or ``None`` and why not: ``busy``, ``sequence``, ``not_ready``, ``missing`` or
        ``storage`` (a copy read from a published file that can no longer be read, C-RP-46)."""
        folder: str | None = None
        try:
            with transaction.atomic():
                row = ReviewMedia.objects.select_related("version").filter(pk=media_id).first()
                if row is None:
                    return None, "not_ready"
                # One job at a time per version: the lock orders a remake against an upload.
                Version.objects.select_for_update().filter(pk=row.version_id).first()  # pyright: ignore[reportAttributeAccessIssue]
                row = (
                    ReviewMedia.objects.select_for_update().select_related("version").get(pk=row.pk)
                )
                if row.status != Status.READY:
                    return None, "not_ready"
                sequence = row.kind == ReviewMedia.Kind.SEQUENCE
                stored = row.storage_copy
                if row.source == "published_file" and not (
                    row.from_storage and storage_readable(row.storage_root)
                ):
                    return None, "storage"
                if row.source == "storage_path" and not review_source.path_still_readable(
                    row.version.project, row.storage_root, row.storage_path
                ):
                    return None, "storage_path"
                if sequence and not stored and not row.frames_kept:
                    return None, "sequence"
                if ReviewMedia.objects.filter(
                    version_id=row.version_id,  # pyright: ignore[reportAttributeAccessIssue]
                    status__in=ReviewMedia.IN_FLIGHT,
                ).exists():
                    return None, "busy"
                source = _media_root() / row.source_path if row.source_path else None
                if not stored and (
                    source is None or not (source.is_dir() if sequence else source.is_file())
                ):
                    return None, "sequence" if sequence else "missing"
                now = timezone.now()
                made = ReviewMedia(
                    project_id=row.project_id,  # pyright: ignore[reportAttributeAccessIssue]
                    version=row.version,
                    kind=row.kind,
                    status=Status.QUEUED,
                    source_name=row.source_name,
                    source_size=row.source_size,
                    source_sha256=row.source_sha256,
                    source_container=row.source_container,
                    color_space=row.color_space,
                    sequence_name=row.sequence_name,
                    sequence_extension=row.sequence_extension,
                    first_frame=row.first_frame,
                    last_frame=row.last_frame,
                    frames_received=row.frames_received,
                    queued_at=now,
                    created_by=actor if getattr(actor, "pk", None) else None,
                    remake_of=row,
                    # Q-RP-66: the original's date; a copy made before RP-14 dates from its row
                    burn_in_date=row.burn_in_date or row.queued_at.date(),
                    # Q-RP-74: a remake keeps the original's time, it does not start a new one
                    frames_until=row.frames_until if sequence and not stored else None,
                    # C-RP-46: read again from the same published file
                    storage_root=row.storage_root,
                    storage_path=row.storage_path,
                    published_file_id=row.published_file_id,
                )
                made.save()
                folder = made.directory
                if stored or source is None:
                    pass  # nothing to link: the worker reads the published file where it lies
                elif sequence:
                    made.source_path = f"{folder}/source"
                    for frame in sorted(source.iterdir()):
                        cls._link(frame, _media_root() / made.source_path / frame.name)
                else:
                    made.source_path = f"{folder}/source{source.suffix}"
                    cls._link(source, _media_root() / made.source_path)
                if made.source_path:
                    made.save(update_fields=["source_path"])
                _audit(
                    actor=actor,
                    version=row.version,
                    operation="review_media_remake",
                    media=made,
                    action=AuditLog.ACTION_CREATE,
                    description=f"Review {made.kind} of version {row.version.code} queued to be remade.",
                )
                made_id = made.pk
                transaction.on_commit(lambda: enqueue(made_id))
        except IntegrityError:
            if folder:
                _delete_folder(folder)
            return None, "busy"
        except BaseException:
            if folder:
                _delete_folder(folder)
            raise
        return made, None

    @staticmethod
    def _link(source: Path, target: Path) -> None:
        """``target`` becomes another name of ``source`` (a copy where a link cannot be made)."""
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.link(source, target)
        except OSError:
            shutil.copyfile(source, target)

    # ------------------------------------------------------------------ sequences (C-RP-31)

    @classmethod
    def open_sequence(
        cls,
        *,
        actor: Any,
        version: Version,
        name: str,
        extension: str,
        first_frame: int,
        last_frame: int,
        color_space: str = "",
    ) -> ReviewMedia:
        """Open a sequence upload: an ``uploading`` row that takes frames in parts."""
        _require_enabled()
        errors: dict[str, list[str]] = {}
        if not frames.valid_name(name):
            errors["name"] = [
                f"Give the frames' name: 1 to {frames.NAME_MAX_LENGTH} characters, no / or \\."
            ]
        extension = extension.lower()
        if extension not in frames.EXTENSIONS:
            errors["extension"] = [f"Frames can be {', '.join(sorted(frames.EXTENSIONS))}."]
        for field, number in (("first_frame", first_frame), ("last_frame", last_frame)):
            if not 0 <= number <= frames.MAX_FRAME_NUMBER:
                errors[field] = [f"A frame number is 0 to {frames.MAX_FRAME_NUMBER}."]
        if not errors:
            if last_frame < first_frame:
                errors["last_frame"] = ["The last frame comes before the first."]
            elif last_frame - first_frame + 1 > settings.REVIEW_MEDIA_MAX_FRAMES:
                errors["last_frame"] = [
                    f"A sequence has at most {settings.REVIEW_MEDIA_MAX_FRAMES} frames."
                ]
        try:
            color_space = validate_upload_colour(color_space)
        except ValidationError as error:
            errors.update(error.detail)  # pyright: ignore[reportCallIssue, reportArgumentType]
        if errors:
            raise ValidationError(errors)
        frame_format = frames.format_for(extension)
        assert frame_format is not None  # the extension was checked above
        try:
            with transaction.atomic():
                Version.objects.select_for_update().filter(pk=version.pk).first()
                if ReviewMedia.objects.filter(
                    version=version, status__in=ReviewMedia.IN_FLIGHT
                ).exists():
                    raise ReviewMediaBusy()
                media = ReviewMedia(
                    project_id=version.project_id,  # pyright: ignore[reportAttributeAccessIssue]
                    version=version,
                    kind=ReviewMedia.Kind.SEQUENCE,
                    status=Status.UPLOADING,
                    source_name=frames.label(name, extension, first_frame, last_frame),
                    source_container=frame_format.key,
                    sequence_name=name,
                    sequence_extension=extension,
                    color_space=color_space,
                    first_frame=first_frame,
                    last_frame=last_frame,
                    queued_at=timezone.now(),
                    created_by=actor if getattr(actor, "pk", None) else None,
                )
                media.save()
                media.source_path = f"{media.directory}/source"
                media.save(update_fields=["source_path"])
        except IntegrityError as error:
            raise ReviewMediaBusy() from error
        return media

    @staticmethod
    def _require_uploading(row: ReviewMedia) -> None:
        if row.kind != ReviewMedia.Kind.SEQUENCE or row.status != Status.UPLOADING:
            raise ValidationError({"detail": ["This upload is not taking frames."]})

    @staticmethod
    def _stored(row: ReviewMedia) -> set[int]:
        """The frame numbers stored for ``row``, inside its range."""
        folder = _media_root() / row.source_path
        names = os.listdir(folder) if folder.is_dir() else []
        numbers = frames.stored_numbers(names, row.sequence_extension)
        first, last = row.first_frame or 0, row.last_frame or -1
        return {n for n in numbers if first <= n <= last}

    @classmethod
    def add_frames(cls, *, actor: Any, media: ReviewMedia, files: list[Any]) -> dict[str, Any]:
        """Store one part of a sequence's frames; all of the part or none of it (C-RP-31)."""
        _require_enabled()
        cls._require_uploading(media)
        if not 0 < len(files) <= frames.PART_MAX_FILES:
            raise ValidationError(
                {"frames": [f"Send 1 to {frames.PART_MAX_FILES} frames at a time."]}
            )
        frame_format = frames.FORMATS[media.source_container]
        first, last = media.first_frame or 0, media.last_frame or 0
        stored = cls._stored(media)
        problems: list[str] = []
        accepted: list[tuple[int, Any, int]] = []
        seen: set[int] = set()
        for upload in files:
            shown = str(getattr(upload, "name", "") or "").rsplit("/", 1)[-1][:120]
            size = int(getattr(upload, "size", 0) or 0)
            number = frames.frame_number(
                shown, name=media.sequence_name, extension=media.sequence_extension
            )
            if number is None:
                problems.append(f"{shown}: not a frame of {media.source_name}.")
            elif not first <= number <= last:
                problems.append(f"{shown}: frame {number} is outside {first}-{last}.")
            elif number in seen or number in stored:
                problems.append(f"{shown}: frame {number} was already sent.")
            elif size <= 0:
                problems.append(f"{shown}: the file is empty.")
            elif size > settings.REVIEW_MEDIA_MAX_BYTES:
                limit = settings.REVIEW_MEDIA_MAX_BYTES // (1024 * 1024)
                problems.append(f"{shown}: the file is larger than {limit} MB.")
            else:
                upload.seek(0)
                head = upload.read(detect.HEAD_BYTES)
                upload.seek(0)
                if frames.sniff(head) != frame_format:
                    problems.append(
                        f"{shown}: the content is not {media.sequence_extension.upper()}."
                    )
                else:
                    seen.add(number)
                    accepted.append((number, upload, size))
        if problems:
            raise ValidationError({"frames": problems[:10]})
        part_bytes = sum(size for _, _, size in accepted)
        if media.source_size + part_bytes > settings.REVIEW_MEDIA_SEQUENCE_MAX_BYTES:
            raise ValidationError({"frames": [cls._too_large()]})

        folder = _media_root() / media.source_path
        folder.mkdir(parents=True, exist_ok=True)
        written: list[Path] = []

        def undo() -> None:
            for path in written:
                path.unlink(missing_ok=True)

        try:
            for number, upload, _size in accepted:
                target = folder / frames.stored_name(number, media.sequence_extension)
                upload.seek(0)
                with target.open("xb") as handle:  # a frame sent twice at once: one wins
                    written.append(target)
                    for chunk in upload.chunks(_CHUNK):
                        handle.write(chunk)
        except FileExistsError as error:
            undo()
            raise ValidationError(
                {"frames": ["Some of these frames were already sent."]}
            ) from error
        except BaseException:
            undo()
            raise
        with transaction.atomic():
            row = ReviewMedia.objects.select_for_update().get(pk=media.pk)
            if row.status != Status.UPLOADING:
                undo()
                raise ValidationError({"detail": ["This upload is not taking frames."]})
            if row.source_size + part_bytes > settings.REVIEW_MEDIA_SEQUENCE_MAX_BYTES:
                undo()
                raise ValidationError({"frames": [cls._too_large()]})
            stored = cls._stored(row)
            row.source_size += part_bytes
            row.frames_received = len(stored)
            row.queued_at = timezone.now()  # the last activity: the sweep counts from it
            row.save(update_fields=["source_size", "frames_received", "queued_at"])
        return {
            "frames_received": row.frames_received,
            "frames_expected": row.frames_expected,
            "missing_frames": frames.missing(stored, first, last),
        }

    @staticmethod
    def _too_large() -> str:
        limit = settings.REVIEW_MEDIA_SEQUENCE_MAX_BYTES // (1024 * 1024)
        return f"The sequence would be larger than {limit} MB."

    @classmethod
    def complete(cls, *, actor: Any, media: ReviewMedia) -> ReviewMedia:
        """Queue a sequence whose every frame is in (C-RP-31)."""
        _require_enabled()
        with transaction.atomic():
            row = ReviewMedia.objects.select_for_update().select_related("version").get(pk=media.pk)
            cls._require_uploading(row)
            stored = cls._stored(row)
            gaps = frames.missing(stored, row.first_frame or 0, row.last_frame or 0)
            if gaps:
                count = row.frames_expected - len(stored)
                listed = ", ".join(str(n) for n in gaps[:10])
                more = f" and {count - min(count, 10)} more" if count > 10 else ""
                raise ValidationError(
                    {
                        "detail": [f"{count} frames are missing: {listed}{more}."],
                        "missing_frames": [str(n) for n in gaps],
                    }
                )
            row.status = Status.QUEUED
            row.frames_received = len(stored)
            row.queued_at = timezone.now()
            row.save(update_fields=["status", "frames_received", "queued_at"])
            _audit(
                actor=actor,
                version=row.version,
                operation="review_media_upload",
                media=row,
                action=AuditLog.ACTION_CREATE,
                description=(
                    f"Review sequence of {row.frames_received} frames uploaded to version "
                    f"{row.version.code}."
                ),
            )
            row_id = row.pk
            transaction.on_commit(lambda: enqueue(row_id))
        return row

    @classmethod
    def remove(cls, *, actor: Any, media: ReviewMedia) -> ReviewMedia:
        """Take a ready copy off its version, or cancel a sequence still arriving (C-RP-22, C-RP-31).

        Its files go once committed.
        """
        with transaction.atomic():
            row = ReviewMedia.objects.select_for_update().select_related("version").get(pk=media.pk)
            if row.status not in (Status.READY, Status.UPLOADING):
                raise ValidationError(
                    {"detail": ["Only a ready copy, or an upload in progress, can be removed."]}
                )
            cancelled = row.status == Status.UPLOADING
            row.status = Status.REMOVED
            cls._clear_outputs(row)
            row.save(
                update_fields=[
                    "status",
                    "proxy_path",
                    "thumbnail_path",
                    "filmstrip_path",
                    "filmstrip_tiles",
                    "frames_until",
                ]
            )
            _audit(
                actor=actor,
                version=row.version,
                operation="review_media_remove",
                media=row,
                action=AuditLog.ACTION_DELETE,
                description=(
                    f"Review sequence upload cancelled on version {row.version.code}."
                    if cancelled
                    else f"Review {row.kind} removed from version {row.version.code}."
                ),
            )
            folder = row.directory
            transaction.on_commit(lambda: _delete_folder(folder))
        return row

    @staticmethod
    def _clear_outputs(row: ReviewMedia) -> None:
        row.proxy_path = row.thumbnail_path = row.filmstrip_path = ""
        row.filmstrip_tiles = 0
        row.frames_until = None  # its folder, frames included, goes with it

    # ------------------------------------------------------------------ worker side

    @classmethod
    def process(cls, media_id: Any) -> str | None:
        """Make the proxy, thumbnail and filmstrip of a queued row; its final status, or ``None``."""
        with transaction.atomic():
            media = ReviewMedia.objects.select_for_update().filter(pk=media_id).first()
            if media is None or media.status != Status.QUEUED:
                return None  # a redelivered or removed job
            media.status = Status.PROCESSING
            media.started_at = timezone.now()
            media.attempts += 1
            # C-RP-37: the burn-in date is the day the copy is first made; a retry or a remake keeps it
            media.burn_in_date = media.burn_in_date or media.started_at.date()
            media.save(update_fields=["status", "started_at", "attempts", "burn_in_date"])

        stored = media.storage_copy
        try:
            source = cls._storage_input(media) if stored else cls._input(media)
        except _Failed as failure:
            cls._unlink_storage(media)
            return cls._fail(media, failure.code)
        if source is None:
            return cls._fail(media, Code.SOURCE_MISSING)

        work = _media_root() / media.directory / f"work-{uuid.uuid4().hex}"
        work.mkdir(parents=True)
        try:
            probe, made, extra = cls._make(media, source, work)
            final = _media_root() / media.directory
            for name in made.values():
                os.replace(work / name, final / name)
        except _Failed as failure:
            return cls._fail(media, failure.code)
        except SoftTimeLimitExceeded:
            return cls._fail(media, Code.TIMEOUT)
        finally:
            shutil.rmtree(work, ignore_errors=True)
            if stored:
                cls._unlink_storage(media)
        return cls._finish(media, probe, made, extra)

    @staticmethod
    def _storage_input(media: ReviewMedia) -> commands.Input:
        """How ffmpeg reads ``media``'s published file where it lies (C-RP-45, ADR-0042).

        Each file (each frame of a sequence) is resolved under its root's directory, refused if it
        leaves it (symbolic links included) or is not a regular file whose leading bytes are its
        format, and given a symbolic link in the row's folder that ffmpeg reads. Raises ``_Failed``
        with ``storage_unreadable``; the log names the row and the frame, never a path.

        A render read by path (RP-18, C-RP-48) is resolved under the project's *current* review
        folder instead of the whole root, so a link that leaves the folder is refused too, and a
        folder changed since the copy was asked for fails it (``render_unreadable``).
        """
        by_path = media.source == "storage_path"
        code = Code.RENDER_UNREADABLE if by_path else Code.STORAGE_UNREADABLE

        def refuse(reason: str, frame: int | None = None) -> _Failed:
            logger.warning(
                "review_media_storage_unreadable",
                review_media_id=str(media.pk),
                reason=reason,
                frame=frame,
            )
            return _Failed(code)

        if not media.from_storage:
            raise refuse("revoked")
        mount = settings.PUBLISHING_STORAGE_MOUNTS.get(media.storage_root.upper())
        if not mount:
            raise refuse("root_not_read")
        storage_path = media.storage_path
        if by_path:
            project = Project.objects.filter(pk=media.project_id).first()  # pyright: ignore[reportAttributeAccessIssue]
            if not review_source.path_still_readable(project, media.storage_root, storage_path):
                raise refuse("outside_folder")
            review_folder = (review_source.project_folder(project) or ("", ""))[1]
            try:
                # the folder itself must lie on the root, even when it is a link
                mount = str(resolve_mount(mount, review_folder))
            except PathRuleError as error:
                raise refuse("outside_root") from error
            storage_path = storage_path[len(review_folder) + 1 :]

        def resolve(relative: str, frame: int | None = None) -> tuple[Path, bytes]:
            try:
                real = resolve_mount(mount, relative)
                if not real.is_file():
                    raise refuse("missing", frame)
                with real.open("rb") as handle:
                    return real, handle.read(detect.HEAD_BYTES)
            except PathRuleError as error:
                raise refuse("outside_root", frame) from error
            except OSError as error:
                raise refuse("unreadable", frame) from error

        folder = _media_root() / media.directory
        try:
            if media.kind == ReviewMedia.Kind.SEQUENCE:
                frame_format = frames.FORMATS.get(media.source_container)
                if frame_format is None or media.first_frame is None or media.last_frame is None:
                    raise refuse("not_a_sequence")
                links = folder / "source"
                links.mkdir(parents=True, exist_ok=True)
                for number in range(media.first_frame, media.last_frame + 1):
                    real, head = resolve(frame_file_name(storage_path, number), number)
                    if frames.sniff(head) != frame_format:
                        raise refuse("content", number)
                    os.symlink(real, links / frames.stored_name(number, media.sequence_extension))
                return commands.SequenceInput(
                    codec=frame_format.codec,
                    pattern=f"../source/{frames.stored_pattern(media.sequence_extension)}",
                    first=media.first_frame,
                    frame_rate=_sequence_rate(media),
                    linear=frame_format.linear,
                )
            container = detect.CONTAINERS.get(media.source_container)
            real, head = resolve(storage_path)
            if container is None or detect.sniff(head) != container:
                raise refuse("content")
            link = folder / f"source.{detect.extension_of(media.storage_path)}"
            folder.mkdir(parents=True, exist_ok=True)
            os.symlink(real, link)
            return commands.MovieInput(container.demuxer, link)
        except OSError as error:
            raise refuse("unreadable") from error

    @staticmethod
    def _unlink_storage(media: ReviewMedia) -> None:
        """Remove the links a job made to a published file; never what they point to (C-RP-45)."""
        folder = _media_root() / media.directory
        links = folder / "source"
        if links.is_dir() and not links.is_symlink():
            for link in links.iterdir():
                if link.is_symlink():
                    link.unlink()
            try:
                links.rmdir()
            except OSError:
                logger.warning("review_media_storage_links_left", review_media_id=str(media.pk))
        for link in folder.glob("source.*"):
            if link.is_symlink():
                link.unlink()

    @staticmethod
    def _input(media: ReviewMedia) -> commands.Input | None:
        """How ffmpeg reads ``media``'s upload, or ``None`` when it is gone."""
        if not media.source_path:
            return None
        source = _media_root() / media.source_path
        if media.kind == ReviewMedia.Kind.SEQUENCE:
            frame_format = frames.FORMATS.get(media.source_container)
            if (
                frame_format is None
                or media.first_frame is None
                or media.source_path != f"{media.directory}/source"
                or not source.is_dir()
            ):
                return None
            return commands.SequenceInput(
                codec=frame_format.codec,
                # relative to the job's folder (``work-*`` next to ``source``)
                pattern=f"../source/{frames.stored_pattern(media.sequence_extension)}",
                first=media.first_frame,
                frame_rate=_sequence_rate(media),
                linear=frame_format.linear,
            )
        container = detect.CONTAINERS.get(media.source_container)
        if container is None or not source.is_file():
            return None
        return commands.MovieInput(container.demuxer, source)

    @classmethod
    def _make(
        cls, media: ReviewMedia, source: commands.Input, work: Path
    ) -> tuple[commands.Probe, dict[str, str], dict[str, Any]]:
        deadline = time.monotonic() + JOB_BUDGET_SECONDS

        def step(args: list[str], *, failure: str, limit: int | None = None) -> str:
            remaining = max(1, int(deadline - time.monotonic()))
            try:
                result = commands.run(args, cwd=work, timeout=min(limit or remaining, remaining))
            except subprocess.TimeoutExpired as error:
                raise _Failed(Code.TIMEOUT) from error
            except OSError as error:  # the program is missing
                logger.error(
                    "review_media_command_missing", review_media_id=str(media.pk), program=args[0]
                )
                raise _Failed(failure) from error
            if result.returncode != 0:
                logger.warning(
                    "review_media_command_failed",
                    review_media_id=str(media.pk),
                    program=args[0],
                    returncode=result.returncode,
                    stderr=(result.stderr or "")[-_LOG_TAIL:],
                )
                raise _Failed(failure)
            return result.stdout

        ffmpeg, ffprobe = settings.REVIEW_MEDIA_FFMPEG, settings.REVIEW_MEDIA_FFPROBE
        is_still = media.kind == ReviewMedia.Kind.STILL
        raw = step(
            commands.probe_command(ffprobe, source),
            failure=Code.PROBE_FAILED,
            limit=commands.PROBE_TIMEOUT_SECONDS,
        )
        try:
            probe = commands.parse_probe(raw, kind="still" if is_still else "movie")
        except commands.ProbeError as error:
            logger.warning(
                "review_media_unusable", review_media_id=str(media.pk), reason=str(error)
            )
            raise _Failed(Code.UNSUPPORTED_STREAM) from error
        if media.kind == ReviewMedia.Kind.SEQUENCE and probe.frames != media.frames_expected:
            # ffmpeg stops at the first frame it cannot open: the sequence is not whole any more
            logger.warning(
                "review_media_unusable",
                review_media_id=str(media.pk),
                reason=f"{probe.frames} of {media.frames_expected} frames read",
            )
            raise _Failed(Code.UNSUPPORTED_STREAM)

        target, skipped, grading = cls._prepare_colour(media, work)
        if target is not None:
            source = dataclasses.replace(source, colour=True)
        linear = isinstance(source, commands.SequenceInput) and source.linear and not source.colour
        extra: dict[str, Any] = {
            "first_frame": media.first_frame if media.kind == ReviewMedia.Kind.SEQUENCE else None,
            "last_frame": media.last_frame if media.kind == ReviewMedia.Kind.SEQUENCE else None,
            "colour": "ocio" if target else ("srgb_from_linear" if linear else "as_stored"),
            "ocio": target.as_json() if target else None,
            "colour_skipped": skipped,
            # RP-20 (C-RP-53): ``grade``, ``grade_source`` and ``grade_skipped``
            **grading,
            "burn_ins": cls._prepare_burn_in(media, work),
        }

        if is_still:
            made = {"proxy": "proxy.jpg", "thumbnail": "thumbnail.jpg"}
            jobs = [
                commands.still_command(
                    ffmpeg, source, commands.PROXY_MAX_WIDTH, work / made["proxy"]
                ),
                commands.still_command(
                    ffmpeg, source, commands.THUMBNAIL_WIDTH, work / made["thumbnail"]
                ),
            ]
        else:
            made = {
                "proxy": "proxy.mp4",
                "thumbnail": "thumbnail.jpg",
                "filmstrip": "filmstrip.jpg",
            }
            jobs = [
                commands.proxy_command(
                    ffmpeg, source, probe, work / made["proxy"], burn_in=extra["burn_ins"]
                ),
                commands.thumbnail_command(ffmpeg, source, probe, work / made["thumbnail"]),
                commands.filmstrip_command(ffmpeg, source, probe, work / made["filmstrip"]),
            ]
        for args in jobs:
            step(args, failure=Code.TRANSCODE_FAILED)
        for name in made.values():
            produced = work / name
            if not produced.is_file() or produced.stat().st_size == 0:
                logger.warning(
                    "review_media_output_missing", review_media_id=str(media.pk), output=name
                )
                raise _Failed(Code.TRANSCODE_FAILED)
        # RP-25 (C-RP-59, Q-RP-115): the download's slate; whatever goes wrong, the copy stays
        extra["slate"], extra["slate_skipped"] = False, None
        lines, skipped = ([], None) if is_still else cls._prepare_slate(media, probe, work)
        if skipped:
            extra["slate_skipped"] = skipped
        elif lines:
            try:
                cls._make_slate(work, made["proxy"], lines, step)
            except _Failed as failure:
                logger.warning(
                    "review_media_slate_skipped", review_media_id=str(media.pk), reason=failure.code
                )
                extra["slate_skipped"] = failure.code
            else:
                made["download"] = commands.SLATE_DOWNLOAD
                extra["slate"] = True
        return probe, made, extra

    @staticmethod
    def _prepare_slate(
        media: ReviewMedia, probe: commands.Probe, work: Path
    ) -> tuple[list[int], str | None]:
        """Write the slate's line files and font into ``work``: each line's length, or none and why not."""
        lines = _slate_lines(media, probe)
        if lines is None:
            return [], None
        try:
            shutil.copyfile(settings.REVIEW_MEDIA_BURN_IN_FONT, work / commands.BURN_IN_FONT)
        except OSError:
            logger.error(
                "review_media_burn_in_font_missing",
                review_media_id=str(media.pk),
                font=settings.REVIEW_MEDIA_BURN_IN_FONT,
            )
            return [], SLATE_FONT_MISSING
        texts = commands.slate_texts(lines)
        for name, text in texts.items():
            (work / name).write_text(text, encoding="utf-8")
        return [len(text) for text in texts.values()], None

    @staticmethod
    def _make_slate(work: Path, proxy: str, lines: list[int], step: Any) -> None:
        """The card, encoded as the copy is, joined to it without re-encoding into the download; the
        join is checked by its frame count and by decoding it. Raises ``_Failed`` on any problem."""
        ffmpeg, ffprobe = settings.REVIEW_MEDIA_FFMPEG, settings.REVIEW_MEDIA_FFPROBE
        limit = commands.PROBE_TIMEOUT_SECONDS
        try:
            made = commands.parse_copy_format(
                step(
                    commands.copy_probe_command(ffprobe, work / proxy),
                    failure=SLATE_FAILED,
                    limit=limit,
                )
            )
        except commands.ProbeError as error:
            raise _Failed(SLATE_FAILED) from error
        step(
            commands.slate_command(ffmpeg, made, lines, work / commands.SLATE_CARD),
            failure=SLATE_FAILED,
        )
        (work / commands.SLATE_LIST).write_text(commands.slate_list(), encoding="utf-8")
        download = work / commands.SLATE_DOWNLOAD
        step(commands.join_command(ffmpeg, download), failure=SLATE_FAILED)

        def frames_of(path: Path) -> int:
            out = step(
                commands.frame_count_command(ffprobe, path), failure=SLATE_FAILED, limit=limit
            )
            try:
                return int(out.strip().split(",")[0])
            except ValueError as error:
                raise _Failed(SLATE_FAILED) from error

        if frames_of(download) != frames_of(work / proxy) + made.card_frames:
            raise _Failed(SLATE_FAILED)
        step(commands.decode_check_command(ffmpeg, download), failure=SLATE_FAILED)
        if not download.is_file() or download.stat().st_size == 0:
            raise _Failed(SLATE_FAILED)

    @classmethod
    def _prepare_colour(
        cls, media: ReviewMedia, work: Path
    ) -> tuple[colour.Target | None, str | None, dict[str, Any]]:
        """Put the copy's LUT into ``work`` (C-RP-40); its transform, or ``None`` and why not, and
        what the probe records of the shot's grade (RP-20, C-RP-53).

        A colour space the config does not know, or a config that cannot be read, leaves the copy
        made as before RP-15 (logged and recorded in ``colour_skipped``), rather than without a copy.
        """
        project = Project.objects.only(
            "color_space", "review_view", "review_look", "review_grades"
        ).get(pk=media.project_id)  # pyright: ignore[reportAttributeAccessIssue]
        target, skipped = ReviewMediaSelector.colour_target(
            project,
            kind=media.kind,
            container=media.source_container,
            color_space=media.color_space,
        )
        grading: dict[str, Any] = {"grade": None, "grade_source": "", "grade_skipped": None}
        if target is None:
            if skipped:
                logger.warning(
                    "review_media_colour_skipped", review_media_id=str(media.pk), reason=skipped
                )
            return target, skipped, grading
        if project.review_grades:
            grading = cls._prepare_grade(media, project, target, work)
        if grading["grade"] is not None:
            return target, skipped, grading
        try:
            lut = colour.lut_for(target, _media_root() / settings.REVIEW_MEDIA_DIR / LUT_FOLDER)
            shutil.copyfile(lut, work / commands.COLOUR_LUT)
        except (colour.ColourUnavailable, OSError) as error:
            logger.error(
                "review_media_colour_failed", review_media_id=str(media.pk), error=str(error)
            )
            return None, "colour_config_unavailable", {**grading, "grade_skipped": None}
        return target, skipped, grading

    @staticmethod
    def _prepare_grade(
        media: ReviewMedia, project: Project, target: colour.Target, work: Path
    ) -> dict[str, Any]:
        """Bake the copy's LUT with its shot's grade into ``work`` (Q-RP-94); what the probe records.

        Baked for this job only and removed with ``work`` (a graded LUT is per shot and large). A
        config without a grading space, or a bake that fails, leaves the copy made without the
        grade (logged, ``grade_skipped``), rather than without a copy.
        """
        shot = (
            Shot.objects.filter(versions=media.version_id)  # pyright: ignore[reportAttributeAccessIssue]
            .values("grade", "grade_source")
            .first()
        )
        grade, why = ReviewMediaSelector.grade_for(
            project, shot["grade"] if shot else None, managed=True
        )
        if grade is not None:
            try:
                colour.write_graded_lut(target, grade, work / commands.COLOUR_LUT)
                return {"grade": grade, "grade_source": shot["grade_source"], "grade_skipped": None}  # pyright: ignore[reportOptionalSubscript]
            except (colour.ColourUnavailable, OSError) as error:
                logger.error(
                    "review_media_grade_failed", review_media_id=str(media.pk), error=str(error)
                )
                why = "colour_config_unavailable"
        if why:
            logger.warning("review_media_grade_skipped", review_media_id=str(media.pk), reason=why)
        return {"grade": None, "grade_source": "", "grade_skipped": why}

    @staticmethod
    def _prepare_burn_in(media: ReviewMedia, work: Path) -> bool:
        """Write the burn-in's text files and font into ``work``; whether the copy gets burn-ins.

        A font that cannot be read leaves the copy without burn-ins (logged), rather than without a copy.
        """
        burn_in = _burn_in(media)
        if burn_in is None:
            return False
        try:
            shutil.copyfile(settings.REVIEW_MEDIA_BURN_IN_FONT, work / commands.BURN_IN_FONT)
        except OSError:
            logger.error(
                "review_media_burn_in_font_missing",
                review_media_id=str(media.pk),
                font=settings.REVIEW_MEDIA_BURN_IN_FONT,
            )
            return False
        for name, text in commands.burn_in_texts(burn_in).items():
            (work / name).write_text(text, encoding="utf-8")
        return True

    @classmethod
    def _finish(
        cls,
        media: ReviewMedia,
        probe: commands.Probe,
        made: dict[str, str],
        extra: dict[str, Any],
    ) -> str | None:
        folder = media.directory
        older_folders: list[str] = []
        with transaction.atomic():
            row = ReviewMedia.objects.select_for_update().filter(pk=media.pk).first()
            if row is None or row.status != Status.PROCESSING:
                # Swept as stale (or removed) while it ran: what it made is not kept.
                for name in made.values():
                    (_media_root() / folder / name).unlink(missing_ok=True)
                return row.status if row else None
            older = list(
                ReviewMedia.objects.select_for_update()
                .filter(version_id=row.version_id, status__in=[Status.READY, Status.FAILED])  # pyright: ignore[reportAttributeAccessIssue]
                .exclude(pk=row.pk)
            )
            for previous in older:
                previous.status = Status.SUPERSEDED
                cls._clear_outputs(previous)
                previous.save(
                    update_fields=[
                        "status",
                        "proxy_path",
                        "thumbnail_path",
                        "filmstrip_path",
                        "filmstrip_tiles",
                        "frames_until",
                    ]
                )
                older_folders.append(previous.directory)
            row.status = Status.READY
            row.probe = {**probe.as_json(), **extra}
            row.proxy_path = f"{folder}/{made['proxy']}"
            row.thumbnail_path = f"{folder}/{made['thumbnail']}"
            if "filmstrip" in made:
                row.filmstrip_path = f"{folder}/{made['filmstrip']}"
                row.filmstrip_tiles = commands.filmstrip_layout(probe.frames)[1]
            row.error_code = ""
            row.finished_at = timezone.now()
            if row.kind == ReviewMedia.Kind.SEQUENCE:
                # C-RP-41: uploaded frames are kept for a while to remake the copy, else they go now
                # (Q-RP-56); a copy read from a published file keeps nothing (C-RP-45).
                # C-RP-32: an unset range is filled.
                if not row.storage_copy:
                    row.frames_until = _keep_frames_until(row, row.finished_at)
                    if row.frames_until is None and row.source_path:
                        older_folders.append(row.source_path)
                        row.source_path = ""
                Version.objects.filter(
                    pk=row.version_id,  # pyright: ignore[reportAttributeAccessIssue]
                    start_frame__isnull=True,
                    end_frame__isnull=True,
                ).update(
                    start_frame=row.first_frame,
                    end_frame=row.last_frame,
                    updated_at=timezone.now(),
                )
            row.save()
            transaction.on_commit(lambda: [_delete_folder(f) for f in older_folders])
            _publish_finished(row)
        logger.info(
            "review_media_ready", review_media_id=str(row.pk), superseded=len(older_folders)
        )
        return row.status

    @staticmethod
    def _fail(media: ReviewMedia, code: str) -> str | None:
        with transaction.atomic():
            updated = ReviewMedia.objects.filter(pk=media.pk, status=Status.PROCESSING).update(
                status=Status.FAILED, error_code=code, finished_at=timezone.now()
            )
            if updated:
                media.status, media.error_code = Status.FAILED, code
                _publish_finished(media)
        logger.warning("review_media_failed", review_media_id=str(media.pk), error_code=code)
        return Status.FAILED if updated else None

    @staticmethod
    def sweep() -> int:
        """Fail jobs a worker dropped (``processing`` 45 minutes) or a broker lost (``queued`` a day).

        A sequence left ``uploading`` a day after its last part is removed, and its frames deleted
        by the ``media`` worker (C-RP-31). A sequence whose frames were kept past ``frames_until``
        loses them the same way; its copy stays (C-RP-41).
        """
        now = timezone.now()
        abandoned: list[str] = []
        with transaction.atomic():
            rows = list(
                ReviewMedia.objects.select_for_update().filter(
                    status=Status.UPLOADING, queued_at__lt=now - STALE_UPLOADING
                )
            )
            for row in rows:
                row.status, row.finished_at = Status.REMOVED, now
                row.save(update_fields=["status", "finished_at"])
                abandoned.append(row.directory)
            if abandoned:
                transaction.on_commit(lambda: [discard_later(f) for f in abandoned])
        if abandoned:
            logger.warning("review_media_uploads_expired", count=len(abandoned))
        # C-RP-41: a sequence's frames go once their time is up; its copy stays
        expired: list[str] = []
        with transaction.atomic():
            rows = list(
                ReviewMedia.objects.select_for_update()
                .filter(kind=ReviewMedia.Kind.SEQUENCE, frames_until__lte=now)
                .exclude(source_path="")
            )
            for row in rows:
                expired.append(row.source_path)
                row.source_path, row.frames_until = "", None
                row.save(update_fields=["source_path", "frames_until"])
            if expired:
                transaction.on_commit(lambda: [discard_later(f) for f in expired])
        if expired:
            logger.info("review_media_frames_expired", count=len(expired))
        counts = []
        for status, stale in (
            (Status.PROCESSING, {"started_at__lt": now - STALE_PROCESSING}),
            (Status.QUEUED, {"queued_at__lt": now - STALE_QUEUED}),
        ):
            with transaction.atomic():
                rows = list(ReviewMedia.objects.select_for_update().filter(status=status, **stale))
                for row in rows:
                    row.status, row.error_code, row.finished_at = Status.FAILED, Code.TIMEOUT, now
                    row.save(update_fields=["status", "error_code", "finished_at"])
                    _publish_finished(row)
            counts.append(len(rows))
        processing, queued = counts
        if processing or queued:
            logger.warning("review_media_swept", processing=processing, queued=queued)
        return processing + queued + len(abandoned) + len(expired)
