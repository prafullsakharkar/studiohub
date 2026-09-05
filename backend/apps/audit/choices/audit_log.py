"""
Audit Log choices.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _


class AuditAction(models.TextChoices):
    """
    Audit action types.
    """
    
    CREATE = "create", _("Create")
    UPDATE = "update", _("Update")
    DELETE = "delete", _("Delete")
    LOGIN = "login", _("Login")
    LOGOUT = "logout", _("Logout")
    PERMISSION_CHANGE = "permission_change", _("Permission Change")
    ROLE_CHANGE = "role_change", _("Role Change")
    IMPORT = "import", _("Import")
    EXPORT = "export", _("Export")
    API_CALL = "api_call", _("API Call")
    BACKGROUND_JOB = "background_job", _("Background Job")
    ERROR = "error", _("Error")
    TRACK = "track", _("Track")


class AuditSeverity(models.TextChoices):
    """
    Audit severity levels.
    """
    
    DEBUG = "debug", _("Debug")
    INFO = "info", _("Info")
    WARNING = "warning", _("Warning")
    ERROR = "error", _("Error")
    CRITICAL = "critical", _("Critical")


class AuditTarget(models.TextChoices):
    """
    Audit target types.
    """
    
    USER = "user", _("User")
    ORGANIZATION = "organization", _("Organization")
    TEAM = "team", _("Team")
    PROJECT = "project", _("Project")
    SEQUENCE = "sequence", _("Sequence")
    SHOT = "shot", _("Shot")
    ASSET = "asset", _("Asset")
    TASK = "task", _("Task")
    VERSION = "version", _("Version")
    REVIEW = "review", _("Review")
    PLAYLIST = "playlist", _("Playlist")
    MEDIA = "media", _("Media")
    WORKFLOW = "workflow", _("Workflow")
    DELIVERY = "delivery", _("Delivery")
    NOTIFICATION = "notification", _("Notification")
    BILLING = "billing", _("Billing")
    BRANDING = "branding", _("Branding")
    ANALYTICS = "analytics", _("Analytics")
    AI = "ai", _("AI")
    VIDEO = "video", _("Video")
    SETTING = "setting", _("Setting")
    FEATURE_FLAG = "feature_flag", _("Feature Flag")
    THEME = "theme", _("Theme")
    LOCALIZATION = "localization", _("Localization")
