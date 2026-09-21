"""
Platform models for studio notifications and production reports.
"""
from __future__ import annotations

from django.db import models

from apps.core.models.bases.entity import EntityModel
from apps.organization.models.organization import Organization


class StudioNotification(EntityModel):
    """
    A notification surfaced to studio users.

    Represents platform-level events such as dailies published, render
    farm alerts, outsourced packages, and milestone deadlines. Scoped to
    an organization.
    """

    # Notification types
    TYPE_SUCCESS = "success"
    TYPE_WARNING = "warning"
    TYPE_INFO = "info"
    TYPE_CRITICAL = "critical"

    TYPE_CHOICES = [
        (TYPE_SUCCESS, "Success"),
        (TYPE_WARNING, "Warning"),
        (TYPE_INFO, "Info"),
        (TYPE_CRITICAL, "Critical"),
    ]

    title = models.CharField(
        max_length=255,
        help_text="Notification title",
    )

    message = models.TextField(
        blank=True,
        help_text="Notification body",
    )

    type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default=TYPE_INFO,
        db_index=True,
        help_text="Notification type",
    )

    category = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        help_text="Notification category",
    )

    read = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Whether the notification has been read",
    )

    link = models.CharField(
        max_length=500,
        blank=True,
        help_text="Client-side route link",
    )

    timestamp = models.CharField(
        max_length=50,
        blank=True,
        help_text="Human-readable timestamp label",
    )

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="notifications",
        db_index=True,
        help_text="Organization context",
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional notification metadata",
    )

    class Meta:
        db_table = "platform_studio_notification"
        ordering = ("-created_at",)
        verbose_name = "Studio Notification"
        verbose_name_plural = "Studio Notifications"

    def __str__(self):
        return f"{self.title} ({self.type})"


class ProductionReport(EntityModel):
    """
    A generated production report.

    Stores report metadata including a flexible ``summary_metrics`` JSON
    payload, mirroring the frontend mock contract.
    """

    STATUS_COMPLETE = "Complete"
    STATUS_PENDING = "Pending"
    STATUS_FAILED = "Failed"

    STATUS_CHOICES = [
        (STATUS_COMPLETE, "Complete"),
        (STATUS_PENDING, "Pending"),
        (STATUS_FAILED, "Failed"),
    ]

    title = models.CharField(
        max_length=255,
        help_text="Report title",
    )

    project_code = models.CharField(
        max_length=50,
        blank=True,
        db_index=True,
        help_text="Project code the report refers to",
    )

    category = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        help_text="Report category",
    )

    generated_at = models.CharField(
        max_length=100,
        blank=True,
        help_text="Human-readable generation timestamp",
    )

    generated_by = models.CharField(
        max_length=255,
        blank=True,
        help_text="Who generated the report",
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_COMPLETE,
        db_index=True,
        help_text="Report status",
    )

    summary_metrics = models.JSONField(
        default=dict,
        blank=True,
        help_text="Flexible summary metrics",
    )

    download_url = models.CharField(
        max_length=500,
        blank=True,
        help_text="Report download URL",
    )

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="reports",
        db_index=True,
        help_text="Organization context",
    )

    class Meta:
        db_table = "platform_production_report"
        ordering = ("-created_at",)
        verbose_name = "Production Report"
        verbose_name_plural = "Production Reports"

    def __str__(self):
        return f"{self.title} ({self.category})"
