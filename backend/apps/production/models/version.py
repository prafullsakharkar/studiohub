"""
Version model - ProductionVersion
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models.bases import EntityModel
from apps.production.constants import ProductionStatus


class Version(EntityModel):
    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="versions",
        db_index=True,
    )
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="versions",
        null=True,
        blank=True,
        db_index=True,
    )

    code = models.CharField(max_length=100, db_index=True)
    version_number = models.CharField(max_length=20, default="v001", db_index=True)
    version_index = models.PositiveIntegerField(default=1)

    # Entity associations (denormalized for flexibility)
    entity_type = models.CharField(max_length=20, blank=True, default="", db_index=True)
    entity_id = models.CharField(max_length=50, blank=True, default="", db_index=True)
    entity_code = models.CharField(max_length=50, blank=True, default="")
    entity_name = models.CharField(max_length=255, blank=True, default="")

    shot = models.ForeignKey(
        "production.Shot",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="versions",
    )
    asset = models.ForeignKey(
        "production.Asset",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="asset_versions",
    )
    task = models.ForeignKey(
        "production.Task",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="task_versions",
    )

    department = models.CharField(max_length=100, blank=True, default="", db_index=True)

    artist = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="authored_versions",
    )

    status = models.CharField(
        max_length=30,
        choices=ProductionStatus.choices,
        default=ProductionStatus.NOT_STARTED,
        db_index=True,
    )
    is_published = models.BooleanField(default=False, db_index=True)
    is_hero = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False, db_index=True)

    thumbnail_url = models.URLField(max_length=500, blank=True, default="")
    video_url = models.URLField(max_length=500, blank=True, default="")
    source_file_url = models.CharField(max_length=500, blank=True, default="")

    frame_range = models.CharField(max_length=50, blank=True, default="")
    start_frame = models.IntegerField(null=True, blank=True)
    end_frame = models.IntegerField(null=True, blank=True)
    resolution = models.CharField(max_length=50, blank=True, default="4096x2160")
    fps = models.DecimalField(max_digits=5, decimal_places=3, default=24)
    file_size_mb = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    color_space = models.CharField(max_length=50, blank=True, default="ACEScg")
    file_path = models.CharField(max_length=500, blank=True, default="")

    notes = models.TextField(blank=True, default="")
    changelog = models.TextField(blank=True, default="")
    tags = models.JSONField(default=list, blank=True)

    publishing_info = models.JSONField(default=dict, blank=True)
    media_items = models.JSONField(default=list, blank=True)
    attachments = models.JSONField(default=list, blank=True)
    reviews = models.JSONField(default=list, blank=True)
    playlists = models.JSONField(default=list, blank=True)
    notes_list = models.JSONField(default=list, blank=True)
    activity = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "production_version"
        ordering = ("-created_at",)
        unique_together = [("project", "code")]
        indexes = [
            models.Index(fields=["organization", "project"]),
            models.Index(fields=["project", "entity_type"]),
            models.Index(fields=["project", "entity_id"]),
            models.Index(fields=["status"]),
            models.Index(fields=["is_published"]),
            models.Index(fields=["is_archived"]),
            models.Index(fields=["department"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.version_number}"
