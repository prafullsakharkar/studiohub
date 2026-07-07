from django.conf import settings
from django.db import models

from apps.core.models import (
    AuditModel,
    TimeStampedModel,
    UUIDModel,
)


class TrustedDevice(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
):

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="trusted_devices",
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

    ip_address = models.GenericIPAddressField(
        blank=True,
        null=True,
    )

    user_agent = models.TextField(
        blank=True,
    )

    last_login_at = models.DateTimeField(
        blank=True,
        null=True,
    )

    expires_at = models.DateTimeField(
        blank=True,
        null=True,
    )

    is_trusted = models.BooleanField(
        default=True,
        db_index=True,
    )

    revoked_at = models.DateTimeField(
        blank=True,
        null=True,
    )

    class Meta:

        db_table = "identity_trusted_devices"

        indexes = [
            models.Index(
                fields=[
                    "user",
                    "is_trusted",
                ],
            ),
            models.Index(
                fields=[
                    "fingerprint",
                ],
            ),
            models.Index(
                fields=[
                    "expires_at",
                ],
            ),
        ]

    def __str__(self):
        return f"{self.user.email} - Trusted Device"
