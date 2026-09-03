from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import EntityModel
from apps.identity.managers import IPBlacklistManager


class IPBlacklist(EntityModel):
    """
    Stores blocked IP addresses.

    Used by authentication, API access, rate limiting,
    and security middleware.
    """

    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
    )

    network = models.CharField(
        max_length=50,
        blank=True,
        help_text="CIDR notation (e.g. 192.168.1.0/24, 2001:db8::/32)",
    )

    description = models.TextField(
        blank=True,
    )

    reason = models.CharField(
        max_length=255,
        blank=True,
    )

    blocked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="blocked_ips",
    )

    is_active = models.BooleanField(
        default=True,
    )

    expires_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    last_hit_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    hit_count = models.PositiveIntegerField(
        default=0,
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
    )

    objects = IPBlacklistManager()

    class Meta:
        db_table = "identity_ip_blacklist"

        ordering = ("ip_address",)

        indexes = [
            models.Index(fields=("ip_address",)),
            models.Index(fields=("is_active",)),
            models.Index(fields=("expires_at",)),
        ]

    def __str__(self) -> str:
        return self.ip_address

    @property
    def expired(self) -> bool:
        if self.expires_at is None:
            return False

        from django.utils import timezone

        return self.expires_at <= timezone.now()