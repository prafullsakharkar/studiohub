from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import (
    AuditModel,
    MetadataModel,
    SoftDeleteModel,
    TimeStampedModel,
    UUIDModel,
)
from apps.identity.managers.personal_access_token import (
    PersonalAccessTokenManager,
)


class PersonalAccessToken(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
    MetadataModel,
    SoftDeleteModel,
):
    """
    User Personal Access Token.
    """

    objects = PersonalAccessTokenManager()

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="personal_access_tokens",
    )

    name = models.CharField(
        max_length=255,
    )

    prefix = models.CharField(
        max_length=16,
        db_index=True,
    )

    hashed_token = models.CharField(
        max_length=255,
        unique=True,
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
        db_table = "identity_personal_access_token"

        ordering = ("name",)

        indexes = [
            models.Index(fields=("prefix",)),
            models.Index(fields=("is_active",)),
            models.Index(fields=("expires_at",)),
        ]

    def __str__(self):
        return f"{self.user} - {self.name}"
