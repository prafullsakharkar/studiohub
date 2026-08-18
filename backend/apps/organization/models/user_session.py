from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import EntityModel
from apps.identity.choices import (
    AuthenticationMethod,
    Browser,
    DeviceType,
    LogoutReason,
    OperatingSystem,
    SessionStatus,
)
from apps.organization.managers.user_session import (
    UserSessionManager,
)


class UserSession(EntityModel):
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
        related_name="organization_sessions",
        on_delete=models.CASCADE,
    )

    # ------------------------------------------------------------------
    # Organization Context
    # ------------------------------------------------------------------

    organization = models.ForeignKey(
        "organization.Organization",
        related_name="organization_sessions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    office = models.ForeignKey(
        "organization.Office",
        related_name="organization_sessions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    department = models.ForeignKey(
        "organization.Department",
        related_name="organization_sessions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    team = models.ForeignKey(
        "organization.Team",
        related_name="organization_sessions",
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

    status = models.CharField(
        max_length=20,
        choices=SessionStatus.choices,
        db_index=True,
        default=SessionStatus.ACTIVE,
    )

    # ------------------------------------------------------------------
    # Device Information
    # ------------------------------------------------------------------

    device_type = models.CharField(
        max_length=30,
        choices=DeviceType.choices,
        default=DeviceType.DESKTOP,
    )

    browser = models.CharField(
        max_length=50,
        choices=Browser.choices,
        default=Browser.CHROME,
    )

    browser_version = models.CharField(
        max_length=30,
        blank=True,
    )

    operating_system = models.CharField(
        max_length=50,
        choices=OperatingSystem.choices,
        default=OperatingSystem.WINDOWS,
    )

    operating_system_version = models.CharField(
        max_length=30,
        blank=True,
    )

    device_name = models.CharField(
        max_length=255,
        blank=True,
    )

    device_id = models.CharField(
        max_length=255,
        blank=True,
        db_index=True,
    )

    # ------------------------------------------------------------------
    # Network Information
    # ------------------------------------------------------------------

    ip_address = models.GenericIPAddressField(
        protocol="both",
        blank=True,
        null=True,
    )

    user_agent = models.TextField(
        blank=True,
    )

    # ------------------------------------------------------------------
    # Location Information
    # ------------------------------------------------------------------

    country = models.CharField(
        max_length=100,
        blank=True,
    )

    country_code = models.CharField(
        max_length=10,
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

    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
    )

    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
    )

    # ------------------------------------------------------------------
    # Session Timing
    # ------------------------------------------------------------------

    started_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )

    last_activity = models.DateTimeField(
        auto_now=True,
        db_index=True,
    )

    expires_at = models.DateTimeField(
        db_index=True,
    )

    logged_out_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    logout_reason = models.CharField(
        max_length=30,
        choices=LogoutReason.choices,
        blank=True,
    )

    # ------------------------------------------------------------------
    # Security Information
    # ------------------------------------------------------------------

    is_trusted = models.BooleanField(
        default=True,
    )

    is_current = models.BooleanField(
        default=False,
    )

    # ------------------------------------------------------------------
    # Organization Context
    # ------------------------------------------------------------------

    objects = UserSessionManager()

    class Meta:
        db_table = "organization_user_session"

        ordering = ("-started_at",)

        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["status"]),
            models.Index(fields=["started_at"]),
            models.Index(fields=["expires_at"]),
            models.Index(fields=["organization"]),
            models.Index(fields=["department"]),
            models.Index(fields=["team"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.session_key[:8]}... ({self.status})"

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def is_active(self) -> bool:
        return self.status == SessionStatus.ACTIVE

    @property
    def is_expired(self) -> bool:
        return self.expires_at < timezone.now()

    @property
    def is_logged_out(self) -> bool:
        return self.status == SessionStatus.LOGGED_OUT

    # ------------------------------------------------------------------
    # Methods
    # ------------------------------------------------------------------

    def update_last_activity(self) -> None:
        """Update the last activity timestamp."""
        self.last_activity = timezone.now()
        self.save(update_fields=["last_activity"])

    def expire(self) -> None:
        """Mark the session as expired."""
        self.status = SessionStatus.EXPIRED
        self.save(update_fields=["status"])

    def logout(self, reason: str = LogoutReason.USER_LOGOUT) -> None:
        """Log out the session."""
        self.status = SessionStatus.LOGGED_OUT
        self.logged_out_at = timezone.now()
        self.logout_reason = reason
        self.save(update_fields=["status", "logged_out_at", "logout_reason"])

    def revoke(self) -> None:
        """Revoke the session (for security reasons)."""
        self.status = SessionStatus.REVOKED
        self.logged_out_at = timezone.now()
        self.logout_reason = LogoutReason.REVOKED
        self.save(update_fields=["status", "logged_out_at", "logout_reason"])
