from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import EntityModel
from apps.identity.choices import SecurityEventType
from apps.identity.managers import SecurityEventManager


class SecurityEvent(EntityModel):
    """
    Records security-related events for audit and monitoring.
    """

    event_type = models.CharField(
        max_length=50,
        choices=SecurityEventType.choices,
        db_index=True,
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="security_events",
    )

    ip_address = models.GenericIPAddressField(
        blank=True,
        null=True,
    )

    user_agent = models.TextField(
        blank=True,
    )

    description = models.TextField(
        blank=True,
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
    )

    is_critical = models.BooleanField(
        default=False,
        db_index=True,
    )

    occurred_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )

    objects = SecurityEventManager()

    class Meta:
        db_table = "identity_security_events"

        ordering = ("-created_at",)

        indexes = [
            models.Index(fields=["event_type"]),
            models.Index(fields=["is_critical"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:
        if self.user:
            return f"{self.event_type} for {self.user.email}"

        return f"{self.event_type} - {self.created_at}"
