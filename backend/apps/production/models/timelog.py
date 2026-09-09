"""
Timelog model - time entry for a task.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models.bases import EntityModel


class Timelog(EntityModel):
    """
    Timelog entry linked to a Task.
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="timelogs",
        db_index=True,
    )
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="timelogs",
        null=True,
        blank=True,
    )
    task = models.ForeignKey(
        "production.Task",
        on_delete=models.CASCADE,
        related_name="timelogs",
        db_index=True,
    )

    person = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="timelogs",
        db_index=True,
    )

    # Denormalized for frontend
    task_code = models.CharField(max_length=50, blank=True, default="")
    task_title = models.CharField(max_length=255, blank=True, default="")
    project_code = models.CharField(max_length=50, blank=True, default="")

    department = models.CharField(max_length=100, blank=True, default="")

    duration_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    date = models.DateField(db_index=True)

    billable = models.BooleanField(default=True, db_index=True)
    notes = models.TextField(blank=True, default="")

    status = models.CharField(
        max_length=20,
        default="Submitted",
        db_index=True,
        choices=[
            ("Draft", "Draft"),
            ("Submitted", "Submitted"),
            ("Approved", "Approved"),
            ("Rejected", "Rejected"),
        ],
    )

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_timelogs",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default="")

    activity_category = models.CharField(
        max_length=50,
        blank=True,
        default="Direct Work",
    )
    hourly_rate_usd = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    class Meta:
        db_table = "production_timelog"
        ordering = ("-date", "-created_at")
        indexes = [
            models.Index(fields=["organization", "project"]),
            models.Index(fields=["task"]),
            models.Index(fields=["person"]),
            models.Index(fields=["status"]),
            models.Index(fields=["billable"]),
            models.Index(fields=["date"]),
        ]

    def __str__(self):
        return f"{self.task_code} - {self.duration_hours}h"
