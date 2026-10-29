"""
Asset model.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models.functions import Upper

from apps.core.models.bases import EntityModel
from apps.production.constants import AssetCategory, AssetSoftware, ProductionStatus


class Asset(EntityModel):
    """
    Asset within a Project.
    """

    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="assets",
        db_index=True,
    )
    # The show (cut) this record belongs to. A show-bound membership sees only records of its show
    # (TPN review TM-002, ADR-0033 D2); none means not yet assigned to a show, which hides the record
    # from show-bound members and leaves it visible to project-wide ones.
    show = models.ForeignKey(
        "production.Show",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
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
    # The studio's asset type, from the masterdata catalog. ``category`` stays (the API contract);
    # rows whose category matched no catalog entry have no type (D-27).
    asset_type = models.ForeignKey(
        "masterdata.MasterAssetType",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="assets",
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

    # Department/Team as FKs to the global masterdata directory (optional)
    department = models.ForeignKey(
        "masterdata.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assets",
    )
    team = models.ForeignKey(
        "masterdata.Team",
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

    # Additional metadata for frontend compat
    versions = models.JSONField(default=list, blank=True)
    hierarchy = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "production_asset"
        ordering = ("code",)
        unique_together = [("project", "code")]
        constraints = [
            models.UniqueConstraint(
                Upper("code"), "project", name="production_asset_project_ucode_uniq"
            ),
        ]
        indexes = [
            models.Index(fields=["project", "category"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"
