"""
Background Job model for tracking background job execution.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.timestamp import TimeStampedModel
from apps.organization.models.organization import Organization


class BackgroundJob(EntityModel, TimeStampedModel):
    """
    Background job log for tracking background job execution.
    
    Captures all background job information including:
    - Job status
    - Progress
    - Results
    """
    
    # Job types
    TYPE_EXPORT = "export"
    TYPE_IMPORT = "import"
    TYPE_REPORT = "report"
    TYPE_SYNC = "sync"
    TYPE_CLEANUP = "cleanup"
    TYPE_NOTIFICATION = "notification"
    TYPE_ANALYTICS = "analytics"
    TYPE_BACKUP = "backup"
    TYPE_REINDEX = "reindex"
    TYPE_OTHER = "other"
    
    TYPE_CHOICES = [
        (TYPE_EXPORT, _("Export")),
        (TYPE_IMPORT, _("Import")),
        (TYPE_REPORT, _("Report")),
        (TYPE_SYNC, _("Sync")),
        (TYPE_CLEANUP, _("Cleanup")),
        (TYPE_NOTIFICATION, _("Notification")),
        (TYPE_ANALYTICS, _("Analytics")),
        (TYPE_BACKUP, _("Backup")),
        (TYPE_REINDEX, _("Reindex")),
        (TYPE_OTHER, _("Other")),
    ]
    
    # Job status
    STATUS_QUEUED = "queued"
    STATUS_STARTED = "started"
    STATUS_PROGRESS = "progress"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_CANCELLED = "cancelled"
    
    STATUS_CHOICES = [
        (STATUS_QUEUED, _("Queued")),
        (STATUS_STARTED, _("Started")),
        (STATUS_PROGRESS, _("Progress")),
        (STATUS_COMPLETED, _("Completed")),
        (STATUS_FAILED, _("Failed")),
        (STATUS_CANCELLED, _("Cancelled")),
    ]
    
    job_type = models.CharField(
        max_length=50,
        choices=TYPE_CHOICES,
        db_index=True,
        help_text="Type of background job",
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_QUEUED,
        db_index=True,
        help_text="Current status of the job",
    )
    
    progress = models.PositiveSmallIntegerField(
        default=0,
        help_text="Progress percentage (0-100)",
    )
    
    description = models.TextField(
        blank=True,
        help_text="Description of the job",
    )
    
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="background_jobs",
        db_index=True,
        help_text="Organization context",
    )
    
    # Job parameters
    job_id = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text="Unique job ID",
    )
    
    queue_name = models.CharField(
        max_length=100,
        blank=True,
        help_text="Name of the queue",
    )
    
    worker_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="ID of the worker",
    )
    
    started_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the job started",
    )
    
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the job completed",
    )
    
    # Results
    result_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Job result data",
    )
    
    error_message = models.TextField(
        blank=True,
        help_text="Error message (if any)",
    )
    
    class Meta:
        db_table = "background_jobs"
        ordering = ("-created_at",)
        verbose_name = "Background Job"
        verbose_name_plural = "Background Jobs"
    
    def __str__(self):
        return f"{self.job_type}: {self.job_id} ({self.status})"
