from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import EntityModel
from apps.identity.models.oauth_provider import OAuthProvider


class OAuthAccount(EntityModel):
    """
    Stores OAuth accounts linked to users.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="oauth_accounts",
    )

    provider = models.ForeignKey(
        OAuthProvider,
        on_delete=models.CASCADE,
        related_name="oauth_accounts",
    )

    provider_account_id = models.CharField(
        max_length=255,
        db_index=True,
    )

    access_token = models.CharField(
        max_length=1024,
        blank=True,
    )

    refresh_token = models.CharField(
        max_length=1024,
        blank=True,
    )

    expires_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    scope = models.TextField(
        blank=True,
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
    )

    is_connected = models.BooleanField(
        default=True,
        db_index=True,
    )

    last_connected_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "identity_oauth_accounts"

        ordering = ("-created_at",)

        unique_together = ("provider", "provider_account_id")

        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["provider"]),
            models.Index(fields=["is_connected"]),
        ]

    def __str__(self) -> str:
        return f"{self.user.email} - {self.provider.name}"
