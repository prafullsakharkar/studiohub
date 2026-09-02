"""
Sequence model.

A Sequence groups Shots within a Project. It is an Organization-owned,
Project-scoped entity that supports soft-delete (archive) and restore via the
canonical ``EntityModel`` soft-delete machinery.
"""

from __future__ import annotations

from django.db import models

from apps.core.models.bases import EntityModel
from apps.production.constants import ProductionStatus


class Sequence(EntityModel):
    """
    Sequence within a Project.
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="sequences",
        db_index=True,
    )
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="sequences",
        db_index=True,
    )

    code = models.CharField(max_length=50, db_index=True)
    name = models.CharField(max_length=255, blank=True, default="")

    status = models.CharField(
        max_length=30,
        choices=ProductionStatus.choices,
        default=ProductionStatus.NOT_STARTED,
        db_index=True,
    )

    description = models.TextField(blank=True, default="")
    frame_in = models.PositiveIntegerField(default=1001)
    frame_out = models.PositiveIntegerField(default=1100)

    department = models.CharField(max_length=100, blank=True, default="")

    tags = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "production_sequence"
        ordering = ("code",)
        unique_together = [("project", "code")]
        indexes = [
            models.Index(fields=["organization", "project"]),
            models.Index(fields=["project", "code"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"
