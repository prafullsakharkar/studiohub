"""
Review media: upload a movie, a still or an image sequence to a version, process it, retry, remove
(docs/review-pipeline/CONTRACTS.md C-RP-19, C-RP-20, C-RP-22; ADR-0040; C-RP-31 to C-RP-33, RP-12).

Upload, the sequence's parts, retry and remove run in the request; ``process`` runs in the
``celery-media`` worker, which has ffmpeg. Files live under ``MEDIA_ROOT/<row.directory>/``: a movie
or still as ``source.<ext>``, a sequence's frames as ``source/frame.<8 digits>.<ext>``, and the
results as ``proxy.mp4`` (``proxy.jpg`` for a still), ``thumbnail.jpg`` and ``filmstrip.jpg``. A row
that is superseded or removed loses its folder once the change is committed; a sequence loses its
frames once its copy is ready (Q-RP-56).
"""

from __future__ import annotations

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
from apps.production.events.review_media import ReviewMediaFinished
from apps.production.exceptions import ReviewMediaBusy, ReviewMediaDisabled
from apps.production.models import ReviewMedia, Version
from apps.production.transcode import detect
from apps.production.transcode import ffmpeg as commands
from apps.production.transcode import sequence as frames

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

_CHUNK = 1024 * 1024
_LOG_TAIL = 2000


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
        bottom_left=timezone.now().date().isoformat(),
        first_frame=first,
    )


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
    def upload(cls, *, actor: Any, version: Version, upload: Any) -> ReviewMedia:
        """Store ``upload`` for ``version`` and queue its job after commit (C-RP-19)."""
        _require_enabled()
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
            media.save(update_fields=["status", "started_at", "attempts"])

        source = cls._input(media)
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
        return cls._finish(media, probe, made, extra)

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

        linear = isinstance(source, commands.SequenceInput) and source.linear
        extra: dict[str, Any] = {
            "first_frame": media.first_frame if media.kind == ReviewMedia.Kind.SEQUENCE else None,
            "last_frame": media.last_frame if media.kind == ReviewMedia.Kind.SEQUENCE else None,
            "colour": "srgb_from_linear" if linear else "as_stored",
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
        return probe, made, extra

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
                # Q-RP-56: the frames go once the copy is ready; C-RP-32: an unset range is filled.
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
        by the ``media`` worker (C-RP-31).
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
        return processing + queued + len(abandoned)
