"""
Login History model for tracking user login events.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.timestamp import TimeStampedModel
from apps.organization.models.organization import Organization
from apps.identity.models.user import User


class LoginHistory(EntityModel, TimeStampedModel):
    """
    Login history for tracking user login events.
    
    Captures all login attempts including:
    - Successful logins
    - Failed logins
    - Password changes
    - Session management
    """
    
    # Login types
    TYPE_LOGIN = "login"
    TYPE_LOGOUT = "logout"
    TYPE_PASSWORD_CHANGE = "password_change"
    TYPE_PASSWORD_RESET = "password_reset"
    TYPE_MFA_VERIFY = "mfa_verify"
    TYPE_DEVICE_LOGIN = "device_login"
    
    TYPE_CHOICES = [
        (TYPE_LOGIN, _("Login")),
        (TYPE_LOGOUT, _("Logout")),
        (TYPE_PASSWORD_CHANGE, _("Password Change")),
        (TYPE_PASSWORD_RESET, _("Password Reset")),
        (TYPE_MFA_VERIFY, _("MFA Verify")),
        (TYPE_DEVICE_LOGIN, _("Device Login")),
    ]
    
    # Login status
    STATUS_SUCCESS = "success"
    STATUS_FAILED = "failed"
    STATUS_EXPIRED = "expired"
    STATUS_REVOKED = "revoked"
    
    STATUS_CHOICES = [
        (STATUS_SUCCESS, _("Success")),
        (STATUS_FAILED, _("Failed")),
        (STATUS_EXPIRED, _("Expired")),
        (STATUS_REVOKED, _("Revoked")),
    ]
    
    login_type = models.CharField(
        max_length=50,
        choices=TYPE_CHOICES,
        default=TYPE_LOGIN,
        db_index=True,
        help_text="Type of login event",
    )
    
    login_method = models.CharField(
        max_length=30,
        blank=True,
        default="password",
        help_text="Authentication method used (password, sso, mfa, api_token, ...)",
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_SUCCESS,
        db_index=True,
        help_text="Status of the login event",
    )
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="audit_login_history",
        db_index=True,
        help_text="User who logged in",
    )
    
    organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_login_history",
        db_index=True,
        help_text="Organization context (may be unknown, e.g. failed pre-auth logins)",
    )
    
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address of the login",
    )
    
    user_agent = models.TextField(
        blank=True,
        help_text="User agent string",
    )
    
    location = models.CharField(
        max_length=255,
        blank=True,
        help_text="Location of the login",
    )
    
    mfa_enabled = models.BooleanField(
        default=False,
        help_text="Whether MFA was used",
    )
    
    mfa_type = models.CharField(
        max_length=50,
        blank=True,
        help_text="Type of MFA used",
    )
    
    session_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="Session ID",
    )
    
    device_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Name of the device",
    )
    
    device_type = models.CharField(
        max_length=50,
        blank=True,
        help_text="Type of device",
    )
    
    browser = models.CharField(
        max_length=255,
        blank=True,
        help_text="Browser used for the login",
    )
    
    browser_version = models.CharField(
        max_length=50,
        blank=True,
        help_text="Browser version used for the login",
    )
    
    operating_system = models.CharField(
        max_length=100,
        blank=True,
        help_text="Operating system used for the login",
    )
    
    failure_reason = models.TextField(
        blank=True,
        help_text="Reason for login failure",
    )
    
    class Meta:
        db_table = "login_history"
        ordering = ("-created_at",)
        verbose_name = "Login History"
        verbose_name_plural = "Login History"
    
    def __str__(self):
        return f"{self.user.email}: {self.login_type} ({self.status})"
