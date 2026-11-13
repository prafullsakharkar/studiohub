"""
Review media: upload a movie or still to a version, process it, retry, remove
(docs/review-pipeline/CONTRACTS.md C-RP-19, C-RP-20, C-RP-22; ADR-0040).

Upload, retry and remove run in the request; ``process`` runs in the ``celery-media`` worker, which
has ffmpeg. Files live under ``MEDIA_ROOT/<row.directory>/``: the upload as ``source.<ext>`` and the
results as ``proxy.mp4`` (``proxy.jpg`` for a still), ``thumbnail.jpg`` and ``filmstrip.jpg``. A row
that is superseded or removed loses its folder once the change is committed.
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
from apps.production.exceptions import ReviewMediaBusy, ReviewMediaDisabled
from apps.production.models import ReviewMedia, Version
from apps.production.transcode import detect
from apps.production.transcode import ffmpeg as commands

logger = structlog.get_logger(__name__)

Status = ReviewMedia.Status
Code = ReviewMedia.ErrorCode

#: a row left in ``processing`` this long was dropped by its worker
STALE_PROCESSING = timedelta(minutes=45)
#: a row still ``queued`` this long lost its message (the broker was emptied)
STALE_QUEUED = timedelta(hours=24)
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


def enqueue(media_id: Any) -> None:
    """Queue the processing job; called once the upload or retry is committed.

    Sent by name through the project's Celery app (``core.celery``). The web process loads that app
    nowhere else, and Celery's default app knows neither the broker nor the routes, so a
    ``shared_task.delay()`` from a request would not reach the ``media`` worker.
    """
    from core.celery import app

    # The task keeps no result (``ignore_result``): nothing subscribes to the result backend.
    app.send_task(PROCESS_TASK, args=[str(media_id)], ignore_result=True)


def _media_root() -> Path:
    return Path(settings.MEDIA_ROOT)


def _delete_folder(relative: str) -> None:
    folder = _media_root() / relative
    shutil.rmtree(folder, ignore_errors=True)


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

    @classmethod
    def remove(cls, *, actor: Any, media: ReviewMedia) -> ReviewMedia:
        """Take a ready movie off its version; its files go once committed (C-RP-22)."""
        with transaction.atomic():
            row = ReviewMedia.objects.select_for_update().select_related("version").get(pk=media.pk)
            if row.status != Status.READY:
                raise ValidationError({"detail": ["Only a ready movie or still can be removed."]})
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
                description=f"Review {row.kind} removed from version {row.version.code}.",
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

        source = _media_root() / media.source_path
        container = detect.CONTAINERS.get(media.source_container)
        if not media.source_path or not source.is_file() or container is None:
            return cls._fail(media, Code.SOURCE_MISSING)

        work = _media_root() / media.directory / f"work-{uuid.uuid4().hex}"
        work.mkdir(parents=True)
        try:
            probe, made = cls._make(media, container, source, work)
            final = _media_root() / media.directory
            for name in made.values():
                os.replace(work / name, final / name)
        except _Failed as failure:
            return cls._fail(media, failure.code)
        except SoftTimeLimitExceeded:
            return cls._fail(media, Code.TIMEOUT)
        finally:
            shutil.rmtree(work, ignore_errors=True)
        return cls._finish(media, probe, made)

    @classmethod
    def _make(
        cls, media: ReviewMedia, container: detect.Container, source: Path, work: Path
    ) -> tuple[commands.Probe, dict[str, str]]:
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
        raw = step(
            commands.probe_command(ffprobe, container.demuxer, source),
            failure=Code.PROBE_FAILED,
            limit=commands.PROBE_TIMEOUT_SECONDS,
        )
        try:
            probe = commands.parse_probe(raw, kind=container.kind)
        except commands.ProbeError as error:
            logger.warning(
                "review_media_unusable", review_media_id=str(media.pk), reason=str(error)
            )
            raise _Failed(Code.UNSUPPORTED_STREAM) from error

        if container.kind == ReviewMedia.Kind.STILL:
            made = {"proxy": "proxy.jpg", "thumbnail": "thumbnail.jpg"}
            jobs = [
                commands.still_command(
                    ffmpeg,
                    container.demuxer,
                    source,
                    commands.PROXY_MAX_WIDTH,
                    work / made["proxy"],
                ),
                commands.still_command(
                    ffmpeg,
                    container.demuxer,
                    source,
                    commands.THUMBNAIL_WIDTH,
                    work / made["thumbnail"],
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
                    ffmpeg, container.demuxer, source, probe, work / made["proxy"]
                ),
                commands.thumbnail_command(
                    ffmpeg, container.demuxer, source, probe, work / made["thumbnail"]
                ),
                commands.filmstrip_command(
                    ffmpeg, container.demuxer, source, probe, work / made["filmstrip"]
                ),
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
        return probe, made

    @classmethod
    def _finish(cls, media: ReviewMedia, probe: commands.Probe, made: dict[str, str]) -> str | None:
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
            row.probe = probe.as_json()
            row.proxy_path = f"{folder}/{made['proxy']}"
            row.thumbnail_path = f"{folder}/{made['thumbnail']}"
            if "filmstrip" in made:
                row.filmstrip_path = f"{folder}/{made['filmstrip']}"
                row.filmstrip_tiles = commands.filmstrip_layout(probe.frames)[1]
            row.error_code = ""
            row.finished_at = timezone.now()
            row.save()
            transaction.on_commit(lambda: [_delete_folder(f) for f in older_folders])
        logger.info(
            "review_media_ready", review_media_id=str(row.pk), superseded=len(older_folders)
        )
        return row.status

    @staticmethod
    def _fail(media: ReviewMedia, code: str) -> str | None:
        updated = ReviewMedia.objects.filter(pk=media.pk, status=Status.PROCESSING).update(
            status=Status.FAILED, error_code=code, finished_at=timezone.now()
        )
        logger.warning("review_media_failed", review_media_id=str(media.pk), error_code=code)
        return Status.FAILED if updated else None

    @staticmethod
    def sweep() -> int:
        """Fail jobs a worker dropped (``processing`` 45 minutes) or a broker lost (``queued`` a day)."""
        now = timezone.now()
        processing = ReviewMedia.objects.filter(
            status=Status.PROCESSING, started_at__lt=now - STALE_PROCESSING
        ).update(status=Status.FAILED, error_code=Code.TIMEOUT, finished_at=now)
        queued = ReviewMedia.objects.filter(
            status=Status.QUEUED, queued_at__lt=now - STALE_QUEUED
        ).update(status=Status.FAILED, error_code=Code.TIMEOUT, finished_at=now)
        if processing or queued:
            logger.warning("review_media_swept", processing=processing, queued=queued)
        return processing + queued
