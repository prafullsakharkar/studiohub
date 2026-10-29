from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import PlatformScopedModel
from apps.identity.managers.rbac import PersonalAccessTokenManager


class PersonalAccessToken(PlatformScopedModel):
    """
    User Personal Access Token. Platform-global.
    """

    objects: PersonalAccessTokenManager = PersonalAccessTokenManager()

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="identity_personal_access_tokens",
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

    revoked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Set when the credential was deliberately revoked. A credential "
        "that is merely inactive (owner suspended) has no revoked_at and is "
        "restored with the account; a revoked one never is.",
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

    @property
    def principal(self):
        return self.user

    @property
    def expired(self):
        if not self.expires_at:
            return False

        from django.utils import timezone

        return self.expires_at <= timezone.now()

    def __str__(self):
        return f"{self.user} - {self.name}"
