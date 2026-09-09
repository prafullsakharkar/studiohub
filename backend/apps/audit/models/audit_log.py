"""
Audit Log model for tracking system events.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.timestamp import TimeStampedModel
from apps.organization.models.organization import Organization


class AuditLog(EntityModel, TimeStampedModel):
    """
    Audit log for tracking system events.
    
    Captures all significant system events including:
    - User actions (create, update, delete)
    - System events
    - Security events
    """
    
    # Action types
    ACTION_CREATE = "create"
    ACTION_UPDATE = "update"
    ACTION_DELETE = "delete"
    ACTION_LOGIN = "login"
    ACTION_LOGOUT = "logout"
    ACTION_PERMISSION_CHANGE = "permission_change"
    ACTION_ROLE_CHANGE = "role_change"
    ACTION_IMPORT = "import"
    ACTION_EXPORT = "export"
    ACTION_API_CALL = "api_call"
    ACTION_BACKGROUND_JOB = "background_job"
    ACTION_ERROR = "error"
    ACTION_TRACK = "track"
    
    ACTION_CHOICES = [
        (ACTION_CREATE, _("Create")),
        (ACTION_UPDATE, _("Update")),
        (ACTION_DELETE, _("Delete")),
        (ACTION_LOGIN, _("Login")),
        (ACTION_LOGOUT, _("Logout")),
        (ACTION_PERMISSION_CHANGE, _("Permission Change")),
        (ACTION_ROLE_CHANGE, _("Role Change")),
        (ACTION_IMPORT, _("Import")),
        (ACTION_EXPORT, _("Export")),
        (ACTION_API_CALL, _("API Call")),
        (ACTION_BACKGROUND_JOB, _("Background Job")),
        (ACTION_ERROR, _("Error")),
        (ACTION_TRACK, _("Track")),
    ]
    
    # Severity levels
    SEVERITY_DEBUG = "debug"
    SEVERITY_INFO = "info"
    SEVERITY_WARNING = "warning"
    SEVERITY_ERROR = "error"
    SEVERITY_CRITICAL = "critical"
    
    SEVERITY_CHOICES = [
        (SEVERITY_DEBUG, _("Debug")),
        (SEVERITY_INFO, _("Info")),
        (SEVERITY_WARNING, _("Warning")),
        (SEVERITY_ERROR, _("Error")),
        (SEVERITY_CRITICAL, _("Critical")),
    ]
    
    # Target types
    TARGET_USER = "user"
    TARGET_ORGANIZATION = "organization"
    TARGET_TEAM = "team"
    TARGET_PROJECT = "project"
    TARGET_SEQUENCE = "sequence"
    TARGET_SHOT = "shot"
    TARGET_ASSET = "asset"
    TARGET_TASK = "task"
    TARGET_VERSION = "version"
    TARGET_REVIEW = "review"
    TARGET_PLAYLIST = "playlist"
    TARGET_MEDIA = "media"
    TARGET_WORKFLOW = "workflow"
    TARGET_DELIVERY = "delivery"
    TARGET_NOTIFICATION = "notification"
    TARGET_BILLING = "billing"
    TARGET_BRANDING = "branding"
    TARGET_ANALYTICS = "analytics"
    TARGET_AI = "ai"
    TARGET_VIDEO = "video"
    TARGET_SETTING = "setting"
    TARGET_FEATURE_FLAG = "feature_flag"
    TARGET_THEME = "theme"
    TARGET_LOCALIZATION = "localization"

    TARGET_CHOICES = [
        (TARGET_USER, _("User")),
        (TARGET_ORGANIZATION, _("Organization")),
        (TARGET_TEAM, _("Team")),
        (TARGET_PROJECT, _("Project")),
        (TARGET_SEQUENCE, _("Sequence")),
        (TARGET_SHOT, _("Shot")),
        (TARGET_ASSET, _("Asset")),
        (TARGET_TASK, _("Task")),
        (TARGET_VERSION, _("Version")),
        (TARGET_REVIEW, _("Review")),
        (TARGET_PLAYLIST, _("Playlist")),
        (TARGET_MEDIA, _("Media")),
        (TARGET_WORKFLOW, _("Workflow")),
        (TARGET_DELIVERY, _("Delivery")),
        (TARGET_NOTIFICATION, _("Notification")),
        (TARGET_BILLING, _("Billing")),
        (TARGET_BRANDING, _("Branding")),
        (TARGET_ANALYTICS, _("Analytics")),
        (TARGET_AI, _("AI")),
        (TARGET_VIDEO, _("Video")),
        (TARGET_SETTING, _("Setting")),
        (TARGET_FEATURE_FLAG, _("Feature Flag")),
        (TARGET_THEME, _("Theme")),
        (TARGET_LOCALIZATION, _("Localization")),
    ]
    
    action = models.CharField(
        max_length=50,
        choices=ACTION_CHOICES,
        db_index=True,
        help_text="Type of action performed",
    )
    
    severity = models.CharField(
        max_length=20,
        choices=SEVERITY_CHOICES,
        default=SEVERITY_INFO,
        db_index=True,
        help_text="Severity level of the event",
    )
    
    target_type = models.CharField(
        max_length=50,
        choices=TARGET_CHOICES,
        db_index=True,
        help_text="Type of target affected",
    )
    
    target_id = models.CharField(
        max_length=100,
        db_index=True,
        help_text="ID of the target affected",
    )
    
    target_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Name of the target affected",
    )
    
    description = models.TextField(
        blank=True,
        help_text="Description of the event",
    )
    
    actor = models.ForeignKey(
        "identity.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
        db_index=True,
        help_text="User who performed the action",
    )
    
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="audit_logs",
        db_index=True,
        help_text="Organization context",
    )
    
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address of the actor",
    )
    
    user_agent = models.TextField(
        blank=True,
        help_text="User agent string",
    )
    
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata about the event",
    )
    
    class Meta:
        db_table = "audit_logs"
        ordering = ("-created_at",)
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"
    
    def __str__(self):
        return f"{self.action}: {self.target_type} {self.target_id}"
