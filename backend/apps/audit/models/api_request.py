"""
API Request model for tracking API calls.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.timestamp import TimeStampedModel
from apps.identity.models.user import User
from apps.organization.models.organization import Organization


class APIRequest(EntityModel, TimeStampedModel):
    """
    API request log for tracking API calls.
    
    Captures all API requests including:
    - Request details
    - Response details
    - Performance metrics
    """
    
    # HTTP methods
    METHOD_GET = "GET"
    METHOD_POST = "POST"
    METHOD_PUT = "PUT"
    METHOD_PATCH = "PATCH"
    METHOD_DELETE = "DELETE"
    METHOD_OPTIONS = "OPTIONS"
    METHOD_HEAD = "HEAD"
    
    METHOD_CHOICES = [
        (METHOD_GET, _("GET")),
        (METHOD_POST, _("POST")),
        (METHOD_PUT, _("PUT")),
        (METHOD_PATCH, _("PATCH")),
        (METHOD_DELETE, _("DELETE")),
        (METHOD_OPTIONS, _("OPTIONS")),
        (METHOD_HEAD, _("HEAD")),
    ]
    
    # Status categories
    STATUS_SUCCESS = "success"
    STATUS_CLIENT_ERROR = "client_error"
    STATUS_SERVER_ERROR = "server_error"
    
    STATUS_CATEGORY_CHOICES = [
        (STATUS_SUCCESS, _("Success")),
        (STATUS_CLIENT_ERROR, _("Client Error")),
        (STATUS_SERVER_ERROR, _("Server Error")),
    ]
    
    method = models.CharField(
        max_length=10,
        choices=METHOD_CHOICES,
        db_index=True,
        help_text="HTTP method",
    )
    
    path = models.CharField(
        max_length=500,
        db_index=True,
        help_text="Request path",
    )
    
    full_path = models.TextField(
        blank=True,
        help_text="Full request path with query parameters",
    )
    
    status_code = models.PositiveSmallIntegerField(
        db_index=True,
        help_text="HTTP status code",
    )
    
    status_category = models.CharField(
        max_length=20,
        choices=STATUS_CATEGORY_CHOICES,
        db_index=True,
        help_text="Status category",
    )
    
    response_time_ms = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Response time in milliseconds",
    )
    
    request_size_bytes = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Request size in bytes",
    )
    
    response_size_bytes = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Response size in bytes",
    )
    
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="api_requests",
        db_index=True,
        help_text="User who made the request",
    )
    
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="api_requests",
        db_index=True,
        help_text="Organization context",
    )
    
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address of the requester",
    )
    
    user_agent = models.TextField(
        blank=True,
        help_text="User agent string",
    )
    
    api_version = models.CharField(
        max_length=20,
        blank=True,
        help_text="API version",
    )
    
    request_headers = models.JSONField(
        default=dict,
        blank=True,
        help_text="Request headers",
    )
    
    request_body = models.JSONField(
        default=dict,
        blank=True,
        help_text="Request body",
    )
    
    response_headers = models.JSONField(
        default=dict,
        blank=True,
        help_text="Response headers",
    )
    
    response_body = models.JSONField(
        default=dict,
        blank=True,
        help_text="Response body",
    )
    
    error_message = models.TextField(
        blank=True,
        help_text="Error message (if any)",
    )
    
    class Meta:
        db_table = "api_requests"
        ordering = ("-created_at",)
        verbose_name = "API Request"
        verbose_name_plural = "API Requests"
    
    def __str__(self):
        return f"{self.method} {self.path} ({self.status_code})"
