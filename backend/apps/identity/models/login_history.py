"""
Identity-owned login history.

Platform-global record of user login events. No organization context —
organization attribution (if ever needed) is derived from project
memberships, not stored on the login record.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import PlatformScopedModel
from apps.identity.managers.rbac import LoginHistoryManager
from apps.identity.querysets.ledger import ImmutableLedgerError


class LoginHistory(PlatformScopedModel):
    """
    Login history for tracking user login events.

    Append-only: a row is written once when a session is created and never
    changed. Rows leave only through ``LoginHistoryService.purge_expired``
    (queryset delete) and when their user is hard-deleted.

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
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="identity_login_history",
        db_index=True,
        help_text="User who logged in",
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

    objects: LoginHistoryManager = LoginHistoryManager()

    class Meta:
        db_table = "identity_login_history"
        ordering = ("-created_at",)
        verbose_name = "Login History"
        verbose_name_plural = "Login History"

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ImmutableLedgerError("Login history is append-only.")

        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ImmutableLedgerError(
            "Login history rows leave only through the retention job.",
        )

    def __str__(self):
        return f"{self.user_id}: {self.login_type} ({self.status})"
