"""
Track model for tracking user behavior and events.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.timestamp import TimeStampedModel
from apps.organization.models.organization import Organization
from apps.identity.models.user import User


class Track(EntityModel, TimeStampedModel):
    """
    Track model for tracking user behavior and events.
    
    Captures detailed user behavior including:
    - Page views
    - Clicks
    - Form submissions
    - Custom events
    """
    
    # Event types
    EVENT_PAGE_VIEW = "page_view"
    EVENT_CLICK = "click"
    EVENT_FORM_SUBMIT = "form_submit"
    EVENT_SEARCH = "search"
    EVENT_FILTER = "filter"
    EVENT_SORT = "sort"
    EVENT_EXPORT = "export"
    EVENT_IMPORT = "import"
    EVENT_DOWNLOAD = "download"
    EVENT_UPLOAD = "upload"
    EVENT_CUSTOM = "custom"
    
    EVENT_CHOICES = [
        (EVENT_PAGE_VIEW, _("Page View")),
        (EVENT_CLICK, _("Click")),
        (EVENT_FORM_SUBMIT, _("Form Submit")),
        (EVENT_SEARCH, _("Search")),
        (EVENT_FILTER, _("Filter")),
        (EVENT_SORT, _("Sort")),
        (EVENT_EXPORT, _("Export")),
        (EVENT_IMPORT, _("Import")),
        (EVENT_DOWNLOAD, _("Download")),
        (EVENT_UPLOAD, _("Upload")),
        (EVENT_CUSTOM, _("Custom")),
    ]
    
    event_type = models.CharField(
        max_length=50,
        choices=EVENT_CHOICES,
        db_index=True,
        help_text="Type of event",
    )
    
    event_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Name of the event",
    )
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="tracks",
        db_index=True,
        help_text="User who triggered the event",
    )
    
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="tracks",
        db_index=True,
        help_text="Organization context",
    )
    
    session_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="Session ID",
    )
    
    page_url = models.CharField(
        max_length=500,
        blank=True,
        help_text="Page URL",
    )
    
    page_title = models.CharField(
        max_length=255,
        blank=True,
        help_text="Page title",
    )
    
    element_id = models.CharField(
        max_length=255,
        blank=True,
        help_text="Element ID (for clicks)",
    )
    
    element_text = models.CharField(
        max_length=255,
        blank=True,
        help_text="Element text (for clicks)",
    )
    
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional event metadata",
    )
    
    class Meta:
        db_table = "tracks"
        ordering = ("-created_at",)
        verbose_name = "Track"
        verbose_name_plural = "Tracks"
    
    def __str__(self):
        return f"{self.user.email}: {self.event_type} - {self.event_name}"
