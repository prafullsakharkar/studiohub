"""
ProjectNote model.

A production note attached to a Project (optionally referencing a Sequence,
Shot, Asset, Task, or Version). Served by the project-scoped ``notes``
endpoint (list + create).
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models.bases import EntityModel
from apps.production.constants import TaskPriority


class ProjectNoteCategory(models.TextChoices):
    DIRECTOR_FEEDBACK = "Director Feedback", "Director Feedback"
    SUPERVISOR_NOTE = "Supervisor Note", "Supervisor Note"
    CLIENT_NOTE = "Client Note", "Client Note"
    PIPELINE_NOTICE = "Pipeline Notice", "Pipeline Notice"
    TURNOVER_REQUIREMENT = "Turnover Requirement", "Turnover Requirement"
    GENERAL = "General", "General"


class ProjectNoteStatus(models.TextChoices):
    OPEN = "Open", "Open"
    ADDRESSED = "Addressed", "Addressed"
    CLOSED = "Closed", "Closed"


class ProjectNote(EntityModel):
    """
    Note on a project, optionally linked to a production entity.
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="project_notes",
        db_index=True,
    )
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="notes",
        db_index=True,
    )

    entity_type = models.CharField(max_length=20, default="Project", db_index=True)
    entity_id = models.CharField(max_length=50, blank=True, default="", db_index=True)
    entity_code = models.CharField(max_length=50, blank=True, default="")
    entity_name = models.CharField(max_length=255, blank=True, default="")

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="project_notes",
    )
    author_name = models.CharField(max_length=255, blank=True, default="")
    author_avatar = models.URLField(max_length=500, blank=True, default="")
    author_role = models.CharField(max_length=100, blank=True, default="")

    subject = models.CharField(max_length=255, db_index=True)
    body = models.TextField(blank=True, default="")
    category = models.CharField(
        max_length=30,
        choices=ProjectNoteCategory.choices,
        default=ProjectNoteCategory.GENERAL,
        db_index=True,
    )
    priority = models.CharField(
        max_length=20,
        choices=TaskPriority.choices,
        default=TaskPriority.MEDIUM,
        db_index=True,
    )
    tags = models.JSONField(default=list, blank=True)
    status = models.CharField(
        max_length=20,
        choices=ProjectNoteStatus.choices,
        default=ProjectNoteStatus.OPEN,
        db_index=True,
    )

    addressed_by = models.CharField(max_length=255, blank=True, default="")
    addressed_at = models.DateTimeField(null=True, blank=True)
    timecode_ref = models.CharField(max_length=20, blank=True, default="")
    frame_number = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        db_table = "production_project_note"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["organization", "project"]),
            models.Index(fields=["project", "status"]),
            models.Index(fields=["entity_type", "entity_id"]),
        ]

    def __str__(self):
        return f"{self.subject} ({self.project})"
