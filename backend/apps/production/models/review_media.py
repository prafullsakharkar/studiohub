"""
Review media: a movie or still uploaded to a version, and what the media worker made from it
(docs/review-pipeline/CONTRACTS.md C-RP-19 to C-RP-22, review-pipeline RP-5).

The upload and the results live under ``MEDIA_ROOT/review_media/`` and leave only through signed,
per-user links (``services/review_media_links.py``). The paths are ours, never the uploader's.
A version has at most one row in flight (queued or processing) and one ``ready`` row; older rows
stay as ``superseded`` or ``removed``, without files, for the audit trail.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class ReviewMedia(models.Model):
    class Kind(models.TextChoices):
        MOVIE = "movie", "Movie"
        STILL = "still", "Still"

    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"
        SUPERSEDED = "superseded", "Superseded"
        REMOVED = "removed", "Removed"

    class ErrorCode(models.TextChoices):
        PROBE_FAILED = "probe_failed", "The file could not be read."
        UNSUPPORTED_STREAM = "unsupported_stream", "The file has no picture the server can use."
        TRANSCODE_FAILED = "transcode_failed", "The review copy could not be made."
        TIMEOUT = "timeout", "Processing took too long and was stopped."
        SOURCE_MISSING = "source_missing", "The uploaded file is no longer on the server."

    #: statuses of a job that has not finished
    IN_FLIGHT = (Status.QUEUED, Status.PROCESSING)

    #: at most this many processing attempts per upload (the first one and two retries)
    MAX_ATTEMPTS = 3

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        "production.Project", on_delete=models.PROTECT, related_name="review_media"
    )
    version = models.ForeignKey(
        "production.Version", on_delete=models.PROTECT, related_name="review_media"
    )
    kind = models.CharField(max_length=10, choices=Kind.choices)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.QUEUED, db_index=True
    )

    # The upload: its name as the uploader sent it (shown, never used as a path), where we stored it.
    source_name = models.CharField(max_length=255)
    source_path = models.CharField(max_length=500, blank=True, default="")
    source_size = models.PositiveBigIntegerField(default=0)
    source_sha256 = models.CharField(max_length=64, blank=True, default="")
    #: the container the first bytes showed (``transcode/detect.py``); it chooses ffmpeg's demuxer
    source_container = models.CharField(max_length=20, blank=True, default="")

    # What ffprobe read: width, height, fps, frames, duration_seconds, video_codec, has_audio.
    probe = models.JSONField(null=True, blank=True)

    # What the worker made, relative to MEDIA_ROOT; empty until ready and after removal.
    proxy_path = models.CharField(max_length=500, blank=True, default="")
    thumbnail_path = models.CharField(max_length=500, blank=True, default="")
    filmstrip_path = models.CharField(max_length=500, blank=True, default="")
    filmstrip_tiles = models.PositiveSmallIntegerField(default=0)

    error_code = models.CharField(max_length=30, choices=ErrorCode.choices, blank=True, default="")
    attempts = models.PositiveSmallIntegerField(default=0)

    queued_at = models.DateTimeField()
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        db_table = "production_review_media"
        ordering = ("-queued_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=["version"],
                condition=models.Q(status__in=["queued", "processing"]),
                name="production_review_media_one_in_flight_uniq",
            ),
            models.UniqueConstraint(
                fields=["version"],
                condition=models.Q(status="ready"),
                name="production_review_media_one_ready_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["version", "status"], name="production_rm_version_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.kind} {self.status} ({self.pk})"

    @property
    def error_message(self) -> str:
        """A fixed sentence per code; ffmpeg's own output never leaves the log."""
        return str(self.ErrorCode(self.error_code).label) if self.error_code else ""

    @property
    def directory(self) -> str:
        """This row's folder under MEDIA_ROOT."""
        return f"{settings.REVIEW_MEDIA_DIR}/{self.project_id}/{self.version_id}/{self.pk}"  # pyright: ignore[reportAttributeAccessIssue]
