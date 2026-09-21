"""
EditorialCut model.

An editorial turnover/cut belonging to a Project (frontend contract entity
served by the project-scoped ``editorial`` endpoint).
"""

from __future__ import annotations

from django.db import models

from apps.core.models.bases import EntityModel
from apps.production.constants import ProductionStatus


class EditorialCutType(models.TextChoices):
    CONFORM = "Conform", "Conform"
    TURNOVER = "Turnover", "Turnover"
    ROUGH_CUT = "Rough Cut", "Rough Cut"
    FINE_CUT = "Fine Cut", "Fine Cut"
    PICTURE_LOCK = "Picture Lock", "Picture Lock"
    TRAILER_TEASER = "Trailer Teaser", "Trailer Teaser"


class EditorialCut(EntityModel):
    """
    Editorial cut/turnover for a project.
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="editorial_cuts",
        db_index=True,
    )
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="editorial_cuts",
        db_index=True,
    )

    sequence_code = models.CharField(max_length=50, blank=True, default="", db_index=True)
    name = models.CharField(max_length=255, db_index=True)
    code = models.CharField(max_length=50, db_index=True)
    cut_type = models.CharField(
        max_length=30,
        choices=EditorialCutType.choices,
        default=EditorialCutType.TURNOVER,
        db_index=True,
    )
    version = models.CharField(max_length=20, blank=True, default="")
    fps = models.FloatField(default=24)
    duration_frames = models.PositiveIntegerField(default=0)
    duration_tc = models.CharField(max_length=20, blank=True, default="")
    start_tc = models.CharField(max_length=20, blank=True, default="")
    end_tc = models.CharField(max_length=20, blank=True, default="")
    source_edl_filename = models.CharField(max_length=255, blank=True, default="")
    xml_manifest_url = models.URLField(max_length=500, blank=True, default="")

    total_shots_in_cut = models.PositiveIntegerField(default=0)
    matched_vfx_shots = models.PositiveIntegerField(default=0)
    unmatched_shots = models.PositiveIntegerField(default=0)

    editorial_notes = models.TextField(blank=True, default="")
    editor_name = models.CharField(max_length=255, blank=True, default="")
    conformed_by = models.CharField(max_length=255, blank=True, default="")

    status = models.CharField(
        max_length=30,
        choices=ProductionStatus.choices,
        default=ProductionStatus.NOT_STARTED,
        db_index=True,
    )
    burn_in_lut = models.CharField(max_length=255, blank=True, default="")
    thumbnail_url = models.URLField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "production_editorial_cut"
        ordering = ("code",)
        unique_together = [("project", "code")]
        indexes = [
            models.Index(fields=["organization", "project"]),
            models.Index(fields=["project", "code"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"


class EditorialTrackType(models.TextChoices):
    VIDEO = "Video", "Video"
    AUDIO = "Audio", "Audio"
    VFX_PLATES = "VFX Plates", "VFX Plates"
    REFERENCE = "Reference", "Reference"
    SUBTITLES = "Subtitles", "Subtitles"
    MARKERS = "Markers", "Markers"


class EditorialTrackStatus(models.TextChoices):
    ACTIVE = "Active", "Active"
    CONFORMED = "Conformed", "Conformed"
    MUTED = "Muted", "Muted"
    ARCHIVED = "Archived", "Archived"


class EditorialTrack(EntityModel):
    """
    NLE-style timeline track for a project's editorial cut.

    Frontend contract entity served by the flat ``editorial/tracks``
    endpoint (see ``docs/api``); distinct from ``EditorialCut`` (the
    turnover itself), which stays project-scoped.
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="editorial_tracks",
        db_index=True,
    )
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="editorial_tracks",
        null=True,
        blank=True,
        db_index=True,
    )

    cut_id = models.CharField(max_length=100, blank=True, default="", db_index=True)
    cut_name = models.CharField(max_length=255, blank=True, default="")
    track_number = models.PositiveIntegerField(default=1, db_index=True)
    track_type = models.CharField(
        max_length=30,
        choices=EditorialTrackType.choices,
        default=EditorialTrackType.VIDEO,
        db_index=True,
    )
    name = models.CharField(max_length=255, db_index=True)
    codec_or_format = models.CharField(max_length=255, blank=True, default="")
    channels_or_resolution = models.CharField(max_length=255, blank=True, default="")
    frame_rate = models.FloatField(default=24)
    is_locked = models.BooleanField(default=False)
    is_muted = models.BooleanField(default=False)
    is_solo = models.BooleanField(default=False)
    color_tag = models.CharField(max_length=20, blank=True, default="")
    clip_count = models.PositiveIntegerField(default=0)
    description = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=30,
        choices=EditorialTrackStatus.choices,
        default=EditorialTrackStatus.ACTIVE,
        db_index=True,
    )
    start_tc = models.CharField(max_length=20, blank=True, default="")
    end_tc = models.CharField(max_length=20, blank=True, default="")

    class Meta:
        db_table = "production_editorial_track"
        ordering = ("project", "track_number")
        indexes = [
            models.Index(fields=["organization", "project"]),
            models.Index(fields=["project", "track_number"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.name} (track {self.track_number})"
