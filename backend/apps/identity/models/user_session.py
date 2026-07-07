from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import (
    AuditModel,
    MetadataModel,
    SoftDeleteModel,
    TimeStampedModel,
    UUIDModel,
)
from apps.identity.choices import (
    AuthenticationMethod,
    Browser,
    DeviceType,
    LogoutReason,
    OperatingSystem,
    SessionStatus,
)
from apps.identity.managers.user_session import (
    UserSessionManager,
)


class UserSession(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
    SoftDeleteModel,
    MetadataModel,
):
    """
    Enterprise user session.

    Tracks authenticated user sessions, devices, activity,
    security information, and organization context.
    """

    # ------------------------------------------------------------------
    # User
    # ------------------------------------------------------------------

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="sessions",
        on_delete=models.CASCADE,
    )

    # ------------------------------------------------------------------
    # Organization Context
    # ------------------------------------------------------------------

    organization = models.ForeignKey(
        "organization.Organization",
        related_name="sessions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    office = models.ForeignKey(
        "organization.Office",
        related_name="sessions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    department = models.ForeignKey(
        "organization.Department",
        related_name="sessions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    team = models.ForeignKey(
        "organization.Team",
        related_name="sessions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    # ------------------------------------------------------------------
    # Session Identity
    # ------------------------------------------------------------------

    session_key = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
    )

    access_token_jti = models.CharField(
        max_length=255,
        blank=True,
        db_index=True,
    )

    refresh_token_jti = models.CharField(
        max_length=255,
        blank=True,
        db_index=True,
    )

    authentication_method = models.CharField(
        max_length=30,
        choices=AuthenticationMethod.choices,
        default=AuthenticationMethod.PASSWORD,
    )

    # ------------------------------------------------------------------
    # Device
    # ------------------------------------------------------------------

    device_name = models.CharField(
        max_length=255,
        blank=True,
    )

    device_type = models.CharField(
        max_length=20,
        choices=DeviceType.choices,
        default=DeviceType.UNKNOWN,
    )

    browser = models.CharField(
        max_length=30,
        choices=Browser.choices,
        default=Browser.UNKNOWN,
    )

    browser_version = models.CharField(
        max_length=30,
        blank=True,
    )

    operating_system = models.CharField(
        max_length=30,
        choices=OperatingSystem.choices,
        default=OperatingSystem.UNKNOWN,
    )

    os_version = models.CharField(
        max_length=30,
        blank=True,
    )

    user_agent = models.TextField(
        blank=True,
    )

    # ------------------------------------------------------------------
    # Network
    # ------------------------------------------------------------------

    ip_address = models.GenericIPAddressField()

    country = models.CharField(
        max_length=100,
        blank=True,
    )

    region = models.CharField(
        max_length=100,
        blank=True,
    )

    city = models.CharField(
        max_length=100,
        blank=True,
    )

    timezone = models.CharField(
        max_length=100,
        blank=True,
    )

    # ------------------------------------------------------------------
    # Activity
    # ------------------------------------------------------------------

    last_activity_at = models.DateTimeField(
        auto_now=True,
    )

    last_request_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    expires_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    ended_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    status = models.CharField(
        max_length=20,
        choices=SessionStatus.choices,
        default=SessionStatus.ACTIVE,
        db_index=True,
    )

    is_current = models.BooleanField(
        default=False,
    )

    is_trusted = models.BooleanField(
        default=False,
    )

    # ------------------------------------------------------------------
    # Logout
    # ------------------------------------------------------------------

    logout_reason = models.CharField(
        max_length=30,
        choices=LogoutReason.choices,
        blank=True,
    )

    # ------------------------------------------------------------------
    # Refresh Tracking
    # ------------------------------------------------------------------

    refresh_count = models.PositiveIntegerField(
        default=0,
    )

    failed_refresh_count = models.PositiveIntegerField(
        default=0,
    )

    last_refresh_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    # ------------------------------------------------------------------
    # Manager
    # ------------------------------------------------------------------

    objects = UserSessionManager()

    class Meta:
        db_table = "identity_user_session"

        ordering = ("-last_activity_at",)

        indexes = [
            models.Index(
                fields=("user", "status"),
            ),
            models.Index(
                fields=("organization", "status"),
            ),
            models.Index(
                fields=("refresh_token_jti",),
            ),
            models.Index(
                fields=("access_token_jti",),
            ),
            models.Index(
                fields=("expires_at",),
            ),
            models.Index(
                fields=("ip_address",),
            ),
        ]

    def __str__(self):
        return (
            f"{self.user} - " f"{self.device_name or self.device_type} " f"({self.status})"
        )
