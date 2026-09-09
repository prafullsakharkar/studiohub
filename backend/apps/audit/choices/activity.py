"""
Activity choices.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _


class ActivityType(models.TextChoices):
    """
    Activity types.
    """
    
    PAGE_VIEW = "page_view", _("Page View")
    FEATURE_USAGE = "feature_usage", _("Feature Usage")
    INTERACTION = "interaction", _("Interaction")
    SEARCH = "search", _("Search")
    FILTER = "filter", _("Filter")
    EXPORT = "export", _("Export")
    IMPORT = "import", _("Import")
    REPORT = "report", _("Report")
    DASHBOARD = "dashboard", _("Dashboard")
    NOTIFICATION = "notification", _("Notification")


class ActivityStatus(models.TextChoices):
    """
    Activity status.
    """
    
    SUCCESS = "success", _("Success")
    FAILED = "failed", _("Failed")
    PENDING = "pending", _("Pending")
