"""
Playlist model
"""

from __future__ import annotations

from django.db import models

from apps.core.models.bases import EntityModel


class Playlist(EntityModel):
    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="playlists",
        db_index=True,
    )
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="playlists",
        null=True,
        blank=True,
        db_index=True,
    )

    name = models.CharField(max_length=255, db_index=True)
    code = models.CharField(max_length=50, blank=True, default="", db_index=True)
    description = models.TextField(blank=True, default="")

    status = models.CharField(max_length=30, blank=True, default="Active", db_index=True)
    client_only = models.BooleanField(default=False)

    entries = models.JSONField(default=list, blank=True)
    share_settings = models.JSONField(default=dict, blank=True)
    activity = models.JSONField(default=list, blank=True)

    is_archived = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = "production_playlist"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["organization", "project"]),
            models.Index(fields=["status"]),
            models.Index(fields=["is_archived"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"
