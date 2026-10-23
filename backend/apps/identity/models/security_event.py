from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import EntityModel
from apps.identity.choices import SecurityEventType
from apps.identity.managers import SecurityEventManager
from apps.identity.querysets.security_event import ImmutableLedgerError


class SecurityEvent(EntityModel):
    """
    Records security-related events for audit and monitoring.

    Append-only (SEC-AUD-01): a row can be created and read, never changed
    or deleted through the ORM, API, admin or services. Cascades from user
    deletion (``SET_NULL``) are performed by Django's collector and are not
    affected.
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

    objects: SecurityEventManager = SecurityEventManager()

    class Meta:
        db_table = "identity_security_events"

        ordering = ("-created_at",)

        indexes = [
            models.Index(fields=["event_type"]),
            models.Index(fields=["is_critical"]),
            models.Index(fields=["created_at"]),
        ]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ImmutableLedgerError("Security events are append-only.")

        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ImmutableLedgerError("Security events cannot be deleted.")

    def __str__(self) -> str:
        if self.user:
            return f"{self.event_type} for {self.user.email}"

        return f"{self.event_type} - {self.created_at}"
