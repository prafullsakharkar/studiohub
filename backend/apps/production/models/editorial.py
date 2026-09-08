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
