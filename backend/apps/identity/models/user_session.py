from __future__ import annotations

from django.db import models

from apps.core.models import (
    AuditModel,
    MetadataModel,
    SoftDeleteModel,
    TimeStampedModel,
    UUIDModel,
)
from apps.core.models.bases import (
    DeviceInformationModel,
    GeoLocationModel,
    NetworkInformationModel,
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
    DeviceInformationModel,
    NetworkInformationModel,
    GeoLocationModel,
):
    """
    Tracks authenticated user sessions across devices.
    """

    user = models.ForeignKey(
        "identity.User",
        on_delete=models.CASCADE,
        related_name="sessions",
    )

    refresh_token_jti = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
    )

    session_key = models.CharField(
        max_length=255,
        blank=True,
    )

    is_current = models.BooleanField(
        default=False,
    )

    is_trusted = models.BooleanField(
        default=False,
    )

    is_revoked = models.BooleanField(
        default=False,
        db_index=True,
    )

    last_activity_at = models.DateTimeField()

    expires_at = models.DateTimeField()

    revoked_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    revoked_by = models.ForeignKey(
        "identity.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="revoked_sessions",
    )

    objects = UserSessionManager()

    class Meta:

        db_table = "identity_user_sessions"

        ordering = ("-last_activity_at",)

        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["is_revoked"]),
            models.Index(fields=["expires_at"]),
            models.Index(fields=["last_activity_at"]),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.device_name}"
