from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import EntityModel
from apps.organization.managers.api_key import APIKeyManager


class APIKey(EntityModel):
    """
    Organization / Service API Key.
    """

    objects = APIKeyManager()

    name = models.CharField(
        max_length=255,
    )

    description = models.TextField(
        blank=True,
    )

    prefix = models.CharField(
        max_length=16,
        db_index=True,
    )

    hashed_key = models.CharField(
        max_length=255,
        unique=True,
    )

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="api_keys",
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="owned_api_keys",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_api_keys",
    )

    scopes = models.JSONField(
        default=list,
        blank=True,
    )

    expires_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    last_used_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    last_used_ip = models.GenericIPAddressField(
        null=True,
        blank=True,
    )

    is_active = models.BooleanField(
        default=True,
    )

    class Meta:
        db_table = "organization_api_key"

        ordering = ("name",)

        indexes = [
            models.Index(fields=("prefix",)),
            models.Index(fields=("is_active",)),
            models.Index(fields=("expires_at",)),
        ]

    def __str__(self):
        return self.name

    @property
    def expired(self):
        if not self.expires_at:
            return False

        from django.utils import timezone

        return self.expires_at <= timezone.now()
