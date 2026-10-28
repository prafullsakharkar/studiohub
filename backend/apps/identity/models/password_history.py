from __future__ import annotations

from django.conf import settings
from django.db import models


class PasswordHistory(models.Model):
    """
    A password the user had before, kept as its hash so it cannot be set again.

    Written by ``PasswordService`` every time a password is set; the last
    ``PASSWORD_HISTORY_COUNT`` per user are kept. It holds hashes only, never a
    password, and is append-only apart from that pruning.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_history",
    )

    password_hash = models.CharField(max_length=256)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "identity_password_history"
        ordering = ("-created_at", "-id")
        indexes = [
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"PasswordHistory({self.pk})"
