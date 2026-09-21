"""
Show model.

A show is a distributable cut of a project (main feature cut, trailer,
episode) that production entities (shots, assets, tasks) are viewed
through. Projects may carry several shows; the frontend show switcher
and ``show_id`` scoping resolve against these rows instead of the
legacy synthetic ``show-<project>-main`` ids.
"""

from __future__ import annotations

from django.db import models

from apps.core.models.bases import EntityModel


class ShowType(models.TextChoices):
    FEATURE = "Feature Film", "Feature Film"
    EPISODIC = "Episodic Series", "Episodic Series"
    COMMERCIAL = "Commercial", "Commercial"
    TRAILER = "Trailer", "Trailer"
    SHORT = "Short", "Short"


class Show(EntityModel):
    """
    Distributable show/cut belonging to exactly one project.
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="shows",
        db_index=True,
    )
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="shows",
        db_index=True,
    )

    code = models.CharField(max_length=50, db_index=True)
    name = models.CharField(max_length=255, db_index=True)
    show_type = models.CharField(
        max_length=30,
        choices=ShowType.choices,
        default=ShowType.FEATURE,
        db_index=True,
    )
    status = models.CharField(max_length=30, blank=True, default="")
    season = models.CharField(max_length=50, blank=True, default="")
    description = models.TextField(blank=True, default="")
    start_date = models.DateField(null=True, blank=True)
    delivery_date = models.DateField(null=True, blank=True)
    thumbnail_url = models.URLField(max_length=500, blank=True, default="")
    is_primary = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = "production_show"
        ordering = ("project", "-is_primary", "code")
        unique_together = [("project", "code")]
        indexes = [
            models.Index(fields=["organization", "project"]),
            models.Index(fields=["project", "code"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"
