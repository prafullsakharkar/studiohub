from __future__ import annotations

from django.db import models

from apps.core.models import (
    AuditModel,
    DeviceInformationModel,
    GeoLocationModel,
    MetadataModel,
    NetworkInformationModel,
    TimeStampedModel,
    UUIDModel,
)
from apps.identity.choices import (
    LoginMethod,
    LoginStatus,
)
from apps.identity.managers.login_history import (
    LoginHistoryManager,
)


class LoginHistory(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
    MetadataModel,
    DeviceInformationModel,
    NetworkInformationModel,
    GeoLocationModel,
):
    """
    Immutable audit log for authentication attempts.
    """

    login_method = models.CharField(
        max_length=30,
        choices=LoginMethod.choices,
        default=LoginMethod.PASSWORD,
    )

    status = models.CharField(
        max_length=20,
        choices=LoginStatus.choices,
        db_index=True,
    )

    user = models.ForeignKey(
        "identity.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="login_history",
    )

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="login_history",
    )

    session = models.ForeignKey(
        "identity.UserSession",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="login_history",
    )

    email = models.EmailField()

    failure_reason = models.CharField(
        max_length=255,
        blank=True,
    )

    authenticated_at = models.DateTimeField(
        db_index=True,
    )

    logout_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    objects = LoginHistoryManager()

    class Meta:
        db_table = "identity_login_history"

        ordering = ("-authenticated_at",)

        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["status"]),
            models.Index(fields=["authenticated_at"]),
            models.Index(fields=["organization"]),
        ]

    def __str__(self):
        return f"{self.email} ({self.status})"
