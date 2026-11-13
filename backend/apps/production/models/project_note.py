"""
ProjectNote model.

A production note attached to a Project (optionally referencing a Sequence,
Shot, Asset, Task, or Version). Served by the project-scoped ``notes``
endpoint (list + create).
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models.bases import EntityModel, UUIDModel
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

    project = models.ForeignKey(
        "production.Project",
        on_delete=models.PROTECT,
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

    # RP-2 (docs/review-pipeline C-RP-07 to C-RP-13): a reply names its thread (one level deep, a
    # reply to a reply is stored on the root), and a thread may name the task that should act on it.
    parent = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="replies",
    )
    task = models.ForeignKey(
        "production.Task",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="project_notes",
    )

    class Meta:
        db_table = "production_project_note"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["project", "status"]),
            models.Index(fields=["entity_type", "entity_id"]),
        ]

    def __str__(self):
        return f"{self.subject} ({self.project})"


class ProjectNoteLinkType(models.TextChoices):
    """The records a note can be about (Q-RP-14 = A). The task is the note's own field, not a link."""

    EPISODE = "Episode", "Episode"
    SEQUENCE = "Sequence", "Sequence"
    SHOT = "Shot", "Shot"
    ASSET = "Asset", "Asset"
    VERSION = "Version", "Version"
    PLAYLIST = "Playlist", "Playlist"
    REVIEW = "Review", "Review"


class ProjectNoteLink(UUIDModel):
    """
    One record a thread is about (C-RP-07). Written only by the server, after the record was found
    live in the note's project and visible to the writer; ``position`` keeps the order written, and
    the first link is mirrored in the note's ``entity_*`` columns. Replacing a note's links deletes
    the old rows (each delete is in the change log).
    """

    note = models.ForeignKey(ProjectNote, on_delete=models.CASCADE, related_name="links")
    entity_type = models.CharField(max_length=20, choices=ProjectNoteLinkType.choices)
    entity_id = models.UUIDField()
    position = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "production_project_note_link"
        ordering = ("note", "position")
        constraints = [
            models.UniqueConstraint(
                fields=["note", "entity_type", "entity_id"], name="uniq_project_note_link"
            )
        ]
        indexes = [models.Index(fields=["entity_type", "entity_id"])]

    def __str__(self):
        return f"{self.entity_type} {self.entity_id}"


class ProjectNoteMention(UUIDModel):
    """
    A person a note or reply mentions (docs/review-pipeline RP-6, C-RP-25). Written only by the
    server, after the person was found active and able to read the thread; ``position`` keeps the
    order written. Replacing a note's mentions deletes the old rows.
    """

    note = models.ForeignKey(ProjectNote, on_delete=models.CASCADE, related_name="mentions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    position = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "production_project_note_mention"
        ordering = ("note", "position")
        constraints = [
            models.UniqueConstraint(fields=["note", "user"], name="uniq_project_note_mention")
        ]

    def __str__(self):
        return f"{self.note_id} @ {self.user_id}"  # pyright: ignore[reportAttributeAccessIssue]
