from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import EntityModel
from apps.identity.managers.login_attempt import (
    LoginAttemptManager,
)


class LoginAttempt(EntityModel):

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="login_attempts",
    )

    username = models.CharField(
        max_length=255,
        db_index=True,
    )

    ip_address = models.GenericIPAddressField()

    user_agent = models.TextField(
        blank=True,
    )

    success = models.BooleanField(
        default=False,
    )

    reason = models.CharField(
        max_length=255,
        blank=True,
    )

    attempted_at = models.DateTimeField(
        auto_now_add=True,
    )
    locked_until = models.DateTimeField(
        null=True,
        blank=True,
    )

    objects = LoginAttemptManager()

    class Meta:

        db_table = "identity_login_attempts"

        ordering = ("-attempted_at",)

    def __str__(self):

        if self.user:
            return f"Login attempt for {self.user.email}"

        return f"Login attempt for {self.username}"
