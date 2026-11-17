"""
Review media: a movie, a still or an image sequence uploaded to a version, and what the media worker
made from it (docs/review-pipeline/CONTRACTS.md C-RP-19 to C-RP-22, RP-5; C-RP-31, C-RP-32, RP-12).

The upload and the results live under ``MEDIA_ROOT/review_media/`` and leave only through signed,
per-user links (``services/review_media_links.py``). The paths are ours, never the uploader's.
A version has at most one row in flight (uploading, queued or processing) and one ``ready`` row;
older rows stay as ``superseded`` or ``removed``, without files, for the audit trail. A remake
(RP-14, C-RP-37) is a new row that links to the kept upload of the copy it remakes. A sequence's
frames arrive in parts while the row is ``uploading`` and are stored as ``source/frame.<n>.<ext>``.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class ReviewMedia(models.Model):
    class Kind(models.TextChoices):
        MOVIE = "movie", "Movie"
        STILL = "still", "Still"
        SEQUENCE = "sequence", "Sequence"

    class Status(models.TextChoices):
        UPLOADING = "uploading", "Uploading"
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

    #: statuses of a job that has not finished (a sequence still arriving counts)
    IN_FLIGHT = (Status.UPLOADING, Status.QUEUED, Status.PROCESSING)

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

    # A sequence (RP-12): its name and range as opened, and how many frames have arrived.
    sequence_name = models.CharField(max_length=200, blank=True, default="")
    #: the extension the frames carry, as opened (``exr``, ``dpx``, ``tif``, ``tiff``, ``png``, ``jpg``, ``jpeg``)
    sequence_extension = models.CharField(max_length=10, blank=True, default="")
    first_frame = models.IntegerField(null=True, blank=True)
    last_frame = models.IntegerField(null=True, blank=True)
    frames_received = models.PositiveIntegerField(default=0)

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
    # RP-14 (C-RP-37): the copy this row remakes, and the date its burn-ins carry (fixed when first made).
    remake_of = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    burn_in_date = models.DateField(null=True, blank=True)
    # RP-15 (C-RP-40): the colour space the upload named; blank = the project's rule (EXR frames only).
    color_space = models.CharField(max_length=100, blank=True, default="")
    # RP-16 (C-RP-41): until when a ready sequence's frames are kept to remake it (a remake keeps the
    # original's); null for movies, stills and sequences whose frames went at once.
    frames_until = models.DateTimeField(null=True, blank=True)
    # RP-16 (C-RP-43): the settings a copy that could not be remade was kept as it is against
    # ({"burn_ins", "ocio"}); it counts as matching while the project's settings are these.
    kept_for = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "production_review_media"
        ordering = ("-queued_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=["version"],
                condition=models.Q(status__in=["uploading", "queued", "processing"]),
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
    def frames_expected(self) -> int:
        """How many frames a sequence's range holds (0 for a movie or still)."""
        if self.first_frame is None or self.last_frame is None:
            return 0
        return self.last_frame - self.first_frame + 1

    @property
    def frames_kept(self) -> bool:
        """Whether this sequence still has its frames, so its copy can be remade (RP-16, C-RP-41)."""
        return bool(
            self.kind == self.Kind.SEQUENCE
            and self.source_path
            and self.frames_until is not None
            and self.frames_until > timezone.now()
        )

    @property
    def directory(self) -> str:
        """This row's folder under MEDIA_ROOT."""
        return f"{settings.REVIEW_MEDIA_DIR}/{self.project_id}/{self.version_id}/{self.pk}"  # pyright: ignore[reportAttributeAccessIssue]
