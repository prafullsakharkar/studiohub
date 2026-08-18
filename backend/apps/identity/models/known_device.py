from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import EntityModel


class KnownDevice(EntityModel):
    """
    Stores known devices for users.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="known_devices",
    )

    fingerprint = models.CharField(
        max_length=255,
        db_index=True,
    )

    browser = models.CharField(
        max_length=100,
        blank=True,
    )

    platform = models.CharField(
        max_length=100,
        blank=True,
    )

    device_type = models.CharField(
        max_length=50,
        blank=True,
    )

    ip_address = models.GenericIPAddressField(
        blank=True,
        null=True,
    )

    user_agent = models.TextField(
        blank=True,
    )

    first_seen_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    last_seen_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    is_trusted = models.BooleanField(
        default=False,
        db_index=True,
    )

    class Meta:
        db_table = "identity_known_devices"

        ordering = ("-created_at",)

        unique_together = ("user", "fingerprint")

        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["fingerprint"]),
            models.Index(fields=["is_trusted"]),
        ]

    def __str__(self) -> str:
        return f"{self.user.email} - {self.fingerprint}"
