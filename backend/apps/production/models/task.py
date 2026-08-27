"""
Task model - work item for shot/asset.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models.bases import EntityModel
from apps.production.constants import TaskPriority, TaskStatus


class Task(EntityModel):
    """
    Task assigned to a resource, linked to a Shot or Asset via entity_type/id.
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="tasks",
        db_index=True,
    )
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="tasks",
        null=True,
        blank=True,
        db_index=True,
    )

    title = models.CharField(max_length=255, db_index=True)
    code = models.CharField(max_length=50, db_index=True)

    entity_type = models.CharField(
        max_length=20,
        default="Shot",
        db_index=True,
        help_text="Shot, Asset, Sequence, General",
    )
    entity_id = models.CharField(max_length=50, db_index=True, blank=True, default="")
    entity_code = models.CharField(max_length=50, blank=True, default="")
    entity_name = models.CharField(max_length=255, blank=True, default="")

    department = models.CharField(max_length=100, blank=True, default="", db_index=True)
    department_id = models.CharField(max_length=50, blank=True, default="")

    team = models.ForeignKey(
        "organization.Team",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks",
    )

    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_tasks",
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="review_tasks",
    )

    vendor_id = models.CharField(max_length=50, blank=True, default="")
    vendor_name = models.CharField(max_length=255, blank=True, default="")
    vendor_code = models.CharField(max_length=50, blank=True, default="")

    # JSON for complex nested structures
    workflow = models.JSONField(default=dict, blank=True)
    schedule = models.JSONField(default=dict, blank=True)
    dependencies = models.JSONField(default=dict, blank=True)

    description = models.TextField(blank=True, default="")
    software = models.CharField(max_length=100, blank=True, default="")
    tags = models.JSONField(default=list, blank=True)

    status = models.CharField(
        max_length=30,
        choices=TaskStatus.choices,
        default=TaskStatus.NOT_STARTED,
        db_index=True,
    )
    priority = models.CharField(
        max_length=20,
        choices=TaskPriority.choices,
        default=TaskPriority.MEDIUM,
        db_index=True,
    )

    is_archived = models.BooleanField(default=False, db_index=True)

    # Denormalized for quick filtering (also in schedule)
    due_date = models.DateField(null=True, blank=True)
    estimated_hours = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    logged_hours = models.DecimalField(max_digits=6, decimal_places=2, default=0)

    class Meta:
        db_table = "production_task"
        ordering = ("-created_at",)
        unique_together = [("project", "code")]
        indexes = [
            models.Index(fields=["organization", "project"]),
            models.Index(fields=["project", "entity_type"]),
            models.Index(fields=["project", "entity_id"]),
            models.Index(fields=["status"]),
            models.Index(fields=["priority"]),
            models.Index(fields=["is_archived"]),
            models.Index(fields=["department"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.title}"
