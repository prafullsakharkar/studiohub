"""
Version model - ProductionVersion
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models.functions import Upper

from apps.core.models.bases import EntityModel
from apps.production.constants import ProductionStatus


class Version(EntityModel):
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.PROTECT,
        related_name="versions",
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
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="versions",
    )
    asset = models.ForeignKey(
        "production.Asset",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="asset_versions",
    )
    task = models.ForeignKey(
        "production.Task",
        on_delete=models.PROTECT,
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
    # Who published it and when; set by ``VersionService.publish_version``, cleared by unpublishing.
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="published_versions",
    )
    is_hero = models.BooleanField(default=False)
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
        constraints = [
            models.UniqueConstraint(
                Upper("code"), "project", name="production_version_project_ucode_uniq"
            ),
            # A version is about a shot or an asset, never both (DECISIONS D-29).
            models.CheckConstraint(
                condition=models.Q(shot__isnull=True) | models.Q(asset__isnull=True),
                name="production_version_one_entity_ck",
            ),
            # Numbers are unique within a series and never reused (soft-deleted rows keep theirs):
            # the versions of a task, or of a shot or an asset when they have no task.
            models.UniqueConstraint(
                fields=["task", "version_index"],
                condition=models.Q(task__isnull=False),
                name="production_version_task_index_uniq",
            ),
            models.UniqueConstraint(
                fields=["shot", "version_index"],
                condition=models.Q(task__isnull=True, shot__isnull=False),
                name="production_version_shot_index_uniq",
            ),
            models.UniqueConstraint(
                fields=["asset", "version_index"],
                condition=models.Q(task__isnull=True, asset__isnull=False),
                name="production_version_asset_index_uniq",
            ),
            # One live hero version per shot and per asset.
            models.UniqueConstraint(
                fields=["shot"],
                condition=models.Q(is_hero=True, is_deleted=False, shot__isnull=False),
                name="production_version_shot_hero_uniq",
            ),
            models.UniqueConstraint(
                fields=["asset"],
                condition=models.Q(is_hero=True, is_deleted=False, asset__isnull=False),
                name="production_version_asset_hero_uniq",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(start_frame__isnull=True)
                    | models.Q(end_frame__isnull=True)
                    | models.Q(end_frame__gte=models.F("start_frame"))
                ),
                name="production_version_frame_range_ck",
            ),
        ]
        indexes = [
            models.Index(fields=["project", "entity_type"]),
            models.Index(fields=["project", "entity_id"]),
            models.Index(fields=["status"]),
            models.Index(fields=["is_published"]),
            models.Index(fields=["department"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.version_number}"

    def save(self, *args, **kwargs):
        # The text copies follow the shot or asset the version is about (not when a save leaves the links alone).
        update_fields = kwargs.get("update_fields")
        touches_link = update_fields is None or {"shot", "asset"} & set(update_fields)
        linked = self.shot_id or self.asset_id  # pyright: ignore[reportAttributeAccessIssue]
        if linked and touches_link:
            entity = self.shot if self.shot_id else self.asset  # pyright: ignore[reportAttributeAccessIssue]
            self.entity_type = type(entity).__name__
            self.entity_id = str(entity.pk)
            self.entity_code = entity.code
            self.entity_name = getattr(entity, "name", "") or ""
            if update_fields is not None:
                kwargs["update_fields"] = {
                    *update_fields,
                    "entity_type",
                    "entity_id",
                    "entity_code",
                    "entity_name",
                }
        super().save(*args, **kwargs)
