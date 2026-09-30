"""
Episode model.

An Episode groups story content within an episodic Project. It is an
Organization-owned, Project-scoped entity that supports soft-delete
(archive) and restore via the canonical ``EntityModel`` soft-delete
machinery.
"""

from __future__ import annotations

from django.db import models

from apps.core.models.bases import EntityModel
from apps.production.constants import ProductionStatus


class Episode(EntityModel):
    """
    Episode within a Project (episodic productions).
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="episodes",
        db_index=True,
    )
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="episodes",
        db_index=True,
    )

    code = models.CharField(max_length=50, db_index=True)
    name = models.CharField(max_length=255, blank=True, default="")
    season_number = models.PositiveIntegerField(null=True, blank=True)
    episode_number = models.PositiveIntegerField(null=True, blank=True)

    status = models.CharField(
        max_length=30,
        choices=ProductionStatus.choices,
        default=ProductionStatus.NOT_STARTED,
        db_index=True,
    )

    description = models.TextField(blank=True, default="")
    frame_in = models.PositiveIntegerField(default=1001)
    frame_out = models.PositiveIntegerField(default=1100)
    duration_frames = models.PositiveIntegerField(null=True, blank=True)

    air_date = models.DateField(null=True, blank=True)
    delivery_date = models.DateField(null=True, blank=True)

    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "production_episode"
        ordering = ("season_number", "episode_number", "code")
        unique_together = [("project", "code")]
        indexes = [
            models.Index(fields=["organization", "project"]),
            models.Index(fields=["project", "code"]),
            models.Index(fields=["project", "season_number", "episode_number"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"
