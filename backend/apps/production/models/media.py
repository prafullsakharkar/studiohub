"""
Media model
"""

from __future__ import annotations

from django.db import models

from apps.core.models.bases import EntityModel


class Media(EntityModel):
    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="media_items",
        db_index=True,
    )
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="media",
        null=True,
        blank=True,
        db_index=True,
    )

    entity_type = models.CharField(max_length=20, blank=True, default="", db_index=True)
    entity_id = models.CharField(max_length=50, blank=True, default="", db_index=True)

    media_type = models.CharField(max_length=20, blank=True, default="image", db_index=True)
    category = models.CharField(max_length=50, blank=True, default="")
    file_format = models.CharField(max_length=20, blank=True, default="jpg")
    storage_tier = models.CharField(max_length=20, blank=True, default="hot")

    source_url = models.URLField(max_length=500, blank=True, default="")
    preview_url = models.URLField(max_length=500, blank=True, default="")
    thumbnail_url = models.URLField(max_length=500, blank=True, default="")

    file_size_mb = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    resolution = models.CharField(max_length=50, blank=True, default="")

    class Meta:
        db_table = "production_media"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["organization", "project"]),
            models.Index(fields=["entity_type", "entity_id"]),
            models.Index(fields=["media_type"]),
        ]

    def __str__(self):
        return f"{self.media_type} - {self.id}"
