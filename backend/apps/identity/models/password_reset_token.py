from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import EntityModel
from apps.identity.managers.rbac import PasswordResetTokenManager


class PasswordResetToken(EntityModel):
    """
    Single-use, expiring password reset token.

    Only a SHA-256 digest of the token is persisted; the raw value exists only
    in the reset email. Issuing a new token invalidates every outstanding token
    for the same user.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_reset_tokens",
    )

    token_hash = models.CharField(
        max_length=64,
        unique=True,
    )

    expires_at = models.DateTimeField(
        db_index=True,
    )

    used_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
    )

    requested_ip = models.GenericIPAddressField(
        null=True,
        blank=True,
    )

    objects: PasswordResetTokenManager = PasswordResetTokenManager()

    class Meta:
        db_table = "identity_password_reset_token"

        ordering = ("-created_at",)

        indexes = [
            models.Index(
                fields=["user", "expires_at"],
            ),
        ]

    @property
    def is_expired(self) -> bool:
        return self.expires_at <= timezone.now()

    @property
    def is_usable(self) -> bool:
        return self.used_at is None and not self.is_expired

    def __str__(self):
        return f"Password reset for {self.user_id}"
