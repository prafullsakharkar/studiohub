"""
Error Log model for tracking application errors.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.timestamp import TimeStampedModel
from apps.identity.models.user import User
from apps.organization.models.organization import Organization


class ErrorLog(EntityModel, TimeStampedModel):
    """
    Error log for tracking application errors.
    
    Captures all error information including:
    - Error details
    - Stack traces
    - Context information
    """
    
    # Error severity
    SEVERITY_DEBUG = "debug"
    SEVERITY_INFO = "info"
    SEVERITY_WARNING = "warning"
    SEVERITY_ERROR = "error"
    SEVERITY_CRITICAL = "critical"
    SEVERITY_FATAL = "fatal"
    
    SEVERITY_CHOICES = [
        (SEVERITY_DEBUG, _("Debug")),
        (SEVERITY_INFO, _("Info")),
        (SEVERITY_WARNING, _("Warning")),
        (SEVERITY_ERROR, _("Error")),
        (SEVERITY_CRITICAL, _("Critical")),
        (SEVERITY_FATAL, _("Fatal")),
    ]
    
    # Error types
    TYPE_EXCEPTION = "exception"
    TYPE_API_ERROR = "api_error"
    TYPE_DATABASE_ERROR = "database_error"
    TYPE_CACHE_ERROR = "cache_error"
    TYPE_FILE_ERROR = "file_error"
    TYPE_AUTH_ERROR = "auth_error"
    TYPE_VALIDATION_ERROR = "validation_error"
    TYPE_PERMISSION_ERROR = "permission_error"
    TYPE_NETWORK_ERROR = "network_error"
    TYPE_OTHER = "other"
    
    TYPE_CHOICES = [
        (TYPE_EXCEPTION, _("Exception")),
        (TYPE_API_ERROR, _("API Error")),
        (TYPE_DATABASE_ERROR, _("Database Error")),
        (TYPE_CACHE_ERROR, _("Cache Error")),
        (TYPE_FILE_ERROR, _("File Error")),
        (TYPE_AUTH_ERROR, _("Auth Error")),
        (TYPE_VALIDATION_ERROR, _("Validation Error")),
        (TYPE_PERMISSION_ERROR, _("Permission Error")),
        (TYPE_NETWORK_ERROR, _("Network Error")),
        (TYPE_OTHER, _("Other")),
    ]
    
    severity = models.CharField(
        max_length=20,
        choices=SEVERITY_CHOICES,
        default=SEVERITY_ERROR,
        db_index=True,
        help_text="Severity of the error",
    )
    
    error_type = models.CharField(
        max_length=50,
        choices=TYPE_CHOICES,
        db_index=True,
        help_text="Type of error",
    )
    
    error_code = models.CharField(
        max_length=100,
        blank=True,
        help_text="Error code",
    )
    
    message = models.TextField(
        help_text="Error message",
    )
    
    stack_trace = models.TextField(
        blank=True,
        help_text="Full stack trace",
    )
    
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="error_logs",
        db_index=True,
        help_text="User affected by the error",
    )
    
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="error_logs",
        db_index=True,
        help_text="Organization context",
    )
    
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address where the error occurred",
    )
    
    user_agent = models.TextField(
        blank=True,
        help_text="User agent string",
    )
    
    request_path = models.CharField(
        max_length=500,
        blank=True,
        help_text="Request path where the error occurred",
    )
    
    request_method = models.CharField(
        max_length=10,
        blank=True,
        help_text="HTTP method",
    )
    
    context_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional context data",
    )
    
    resolved = models.BooleanField(
        default=False,
        help_text="Whether the error has been resolved",
    )
    
    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the error was resolved",
    )
    
    resolved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_error_logs",
        help_text="User who resolved the error",
    )
    
    class Meta:
        db_table = "error_logs"
        ordering = ("-created_at",)
        verbose_name = "Error Log"
        verbose_name_plural = "Error Logs"
    
    def __str__(self):
        return f"{self.error_type}: {self.message[:100]}"
