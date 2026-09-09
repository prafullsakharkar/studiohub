"""
Error Log choices.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _


class ErrorSeverity(models.TextChoices):
    """
    Error severity levels.
    """
    
    DEBUG = "debug", _("Debug")
    INFO = "info", _("Info")
    WARNING = "warning", _("Warning")
    ERROR = "error", _("Error")
    CRITICAL = "critical", _("Critical")
    FATAL = "fatal", _("Fatal")


class ErrorType(models.TextChoices):
    """
    Error types.
    """
    
    EXCEPTION = "exception", _("Exception")
    API_ERROR = "api_error", _("API Error")
    DATABASE_ERROR = "database_error", _("Database Error")
    CACHE_ERROR = "cache_error", _("Cache Error")
    FILE_ERROR = "file_error", _("File Error")
    AUTH_ERROR = "auth_error", _("Auth Error")
    VALIDATION_ERROR = "validation_error", _("Validation Error")
    PERMISSION_ERROR = "permission_error", _("Permission Error")
    NETWORK_ERROR = "network_error", _("Network Error")
    OTHER = "other", _("Other")
