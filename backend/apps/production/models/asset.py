"""
Asset model.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models.bases import EntityModel
from apps.production.constants import AssetCategory, AssetSoftware, ProductionStatus


class Asset(EntityModel):
    """
    Asset within a Project.
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="assets",
        db_index=True,
    )
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="assets",
        db_index=True,
    )

    name = models.CharField(max_length=255, db_index=True)
    code = models.CharField(max_length=50, db_index=True)
    category = models.CharField(
        max_length=30,
        choices=AssetCategory.choices,
        default=AssetCategory.PROP,
        db_index=True,
    )
    description = models.TextField(blank=True, default="")

    status = models.CharField(
        max_length=30,
        choices=ProductionStatus.choices,
        default=ProductionStatus.NOT_STARTED,
        db_index=True,
    )

    version = models.CharField(max_length=20, default="v001", blank=True)
    file_format = models.CharField(max_length=100, blank=True, default="OpenUSD (.usda)")
    poly_count = models.PositiveIntegerField(default=0)
    lod_levels = models.PositiveIntegerField(default=1)

    software = models.CharField(
        max_length=30,
        choices=AssetSoftware.choices,
        default=AssetSoftware.MAYA,
        blank=True,
    )

    thumbnail_url = models.URLField(max_length=500, blank=True, default="")
    turntable_video_url = models.URLField(max_length=500, blank=True, default="")

    # Department/Team as FK to organization entities (optional)
    department = models.ForeignKey(
        "organization.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assets",
    )
    team = models.ForeignKey(
        "organization.Team",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assets",
    )

    assigned_artist = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_assets",
    )

    parent_asset = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="children",
    )

    tags = models.JSONField(default=list, blank=True)
    usd_prim_path = models.CharField(max_length=255, blank=True, default="")
    usd_stage_url = models.URLField(max_length=500, blank=True, default="")

    is_archived = models.BooleanField(default=False, db_index=True)

    # Additional metadata for frontend compat
    versions = models.JSONField(default=list, blank=True)
    hierarchy = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "production_asset"
        ordering = ("code",)
        unique_together = [("project", "code")]
        indexes = [
            models.Index(fields=["organization", "project"]),
            models.Index(fields=["project", "category"]),
            models.Index(fields=["status"]),
            models.Index(fields=["is_archived"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"
