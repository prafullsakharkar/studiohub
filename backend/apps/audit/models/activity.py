"""
Activity model for tracking user activities.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.timestamp import TimeStampedModel
from apps.identity.models.user import User
from apps.organization.models.organization import Organization


class Activity(EntityModel, TimeStampedModel):
    """
    Activity log for tracking user activities.
    
    Captures detailed user activity information including:
    - Page visits
    - Feature usage
    - Interaction patterns
    """
    
    # Activity types
    TYPE_PAGE_VIEW = "page_view"
    TYPE_FEATURE_USAGE = "feature_usage"
    TYPE_INTERACTION = "interaction"
    TYPE_SEARCH = "search"
    TYPE_FILTER = "filter"
    TYPE_EXPORT = "export"
    TYPE_IMPORT = "import"
    TYPE_REPORT = "report"
    TYPE_DASHBOARD = "dashboard"
    TYPE_NOTIFICATION = "notification"
    
    TYPE_CHOICES = [
        (TYPE_PAGE_VIEW, _("Page View")),
        (TYPE_FEATURE_USAGE, _("Feature Usage")),
        (TYPE_INTERACTION, _("Interaction")),
        (TYPE_SEARCH, _("Search")),
        (TYPE_FILTER, _("Filter")),
        (TYPE_EXPORT, _("Export")),
        (TYPE_IMPORT, _("Import")),
        (TYPE_REPORT, _("Report")),
        (TYPE_DASHBOARD, _("Dashboard")),
        (TYPE_NOTIFICATION, _("Notification")),
    ]
    
    # Activity status
    STATUS_SUCCESS = "success"
    STATUS_FAILED = "failed"
    STATUS_PENDING = "pending"
    
    STATUS_CHOICES = [
        (STATUS_SUCCESS, _("Success")),
        (STATUS_FAILED, _("Failed")),
        (STATUS_PENDING, _("Pending")),
    ]
    
    activity_type = models.CharField(
        max_length=50,
        choices=TYPE_CHOICES,
        db_index=True,
        help_text="Type of activity",
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_SUCCESS,
        db_index=True,
        help_text="Status of the activity",
    )
    
    description = models.TextField(
        blank=True,
        help_text="Description of the activity",
    )
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="activities",
        db_index=True,
        help_text="User who performed the activity",
    )
    
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="activities",
        db_index=True,
        help_text="Organization context",
    )
    
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address of the user",
    )
    
    user_agent = models.TextField(
        blank=True,
        help_text="User agent string",
    )
    
    duration_seconds = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Duration of the activity in seconds",
    )
    
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata about the activity",
    )
    
    class Meta:
        db_table = "activities"
        ordering = ("-created_at",)
        verbose_name = "Activity"
        verbose_name_plural = "Activities"
    
    def __str__(self):
        return f"{self.user.email}: {self.activity_type}"
