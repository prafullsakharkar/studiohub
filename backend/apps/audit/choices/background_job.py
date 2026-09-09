"""
Background Job choices.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _


class JobType(models.TextChoices):
    """
    Background job types.
    """
    
    EXPORT = "export", _("Export")
    IMPORT = "import", _("Import")
    REPORT = "report", _("Report")
    SYNC = "sync", _("Sync")
    CLEANUP = "cleanup", _("Cleanup")
    NOTIFICATION = "notification", _("Notification")
    ANALYTICS = "analytics", _("Analytics")
    BACKUP = "backup", _("Backup")
    REINDEX = "reindex", _("Reindex")
    OTHER = "other", _("Other")


class JobStatus(models.TextChoices):
    """
    Background job status.
    """
    
    QUEUED = "queued", _("Queued")
    STARTED = "started", _("Started")
    PROGRESS = "progress", _("Progress")
    COMPLETED = "completed", _("Completed")
    FAILED = "failed", _("Failed")
    CANCELLED = "cancelled", _("Cancelled")
