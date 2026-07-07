from django.conf import settings
from django.db import models

from apps.core.models import (
    AuditModel,
    TimeStampedModel,
    UUIDModel,
)


class BackupCode(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
):

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="backup_codes",
    )

    code_hash = models.CharField(
        max_length=255,
    )

    used = models.BooleanField(
        default=False,
        db_index=True,
    )

    used_at = models.DateTimeField(
        blank=True,
        null=True,
    )

    expires_at = models.DateTimeField(
        blank=True,
        null=True,
    )

    class Meta:

        db_table = "identity_backup_codes"

        indexes = [
            models.Index(
                fields=[
                    "user",
                    "used",
                ],
            ),
            models.Index(
                fields=[
                    "expires_at",
                ],
            ),
        ]

    def __str__(self):
        return f"Backup Code {self.id}"
