from django.conf import settings
from django.db import models

from apps.core.models import (
    AuditModel,
    MetadataModel,
    TimeStampedModel,
    UUIDModel,
)
from apps.identity.choices.mfa import (
    MFAMethod,
    MFAStatus,
)


class UserMFA(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
    MetadataModel,
):

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mfa",
    )

    totp_secret = models.CharField(
        max_length=255,
        blank=True,
    )

    primary_method = models.CharField(
        max_length=32,
        choices=MFAMethod.choices,
        default=MFAMethod.TOTP,
    )

    status = models.CharField(
        max_length=32,
        choices=MFAStatus.choices,
        default=MFAStatus.DISABLED,
        db_index=True,
    )

    email_enabled = models.BooleanField(
        default=False,
    )

    sms_enabled = models.BooleanField(
        default=False,
    )

    recovery_enabled = models.BooleanField(
        default=True,
    )

    is_verified = models.BooleanField(
        default=False,
        db_index=True,
    )

    last_used_at = models.DateTimeField(
        blank=True,
        null=True,
    )

    failed_attempts = models.PositiveIntegerField(
        default=0,
    )

    locked_until = models.DateTimeField(
        blank=True,
        null=True,
    )

    totp_confirmed_at = models.DateTimeField(
        blank=True,
        null=True,
    )

    last_verified_ip = models.GenericIPAddressField(
        blank=True,
        null=True,
    )

    last_verified_user_agent = models.TextField(
        blank=True,
    )

    class Meta:
        db_table = "identity_user_mfa"

        indexes = [
            models.Index(
                fields=[
                    "status",
                ],
            ),
            models.Index(
                fields=[
                    "is_verified",
                ],
            ),
            models.Index(
                fields=[
                    "locked_until",
                ],
            ),
        ]

    def __str__(self):
        return f"{self.user.email} MFA"
