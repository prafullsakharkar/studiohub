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
from apps.identity.managers.user_preference import (
    UserPreferenceManager,
)


class UserPreference(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
    SoftDeleteModel,
    MetadataModel,
):
    """
    User preferences and UI settings.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="preferences",
    )

    language = models.CharField(
        max_length=20,
        default="en",
    )

    timezone = models.CharField(
        max_length=100,
        default="UTC",
    )

    theme = models.CharField(
        max_length=20,
        default="system",
    )

    date_format = models.CharField(
        max_length=20,
        default="YYYY-MM-DD",
    )

    time_format = models.CharField(
        max_length=10,
        default="24h",
    )

    default_organization = models.ForeignKey(
        "organization.Organization",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    default_department = models.ForeignKey(
        "organization.Department",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    start_page = models.CharField(
        max_length=100,
        default="dashboard",
    )

    items_per_page = models.PositiveSmallIntegerField(
        default=25,
    )

    email_notifications = models.BooleanField(
        default=True,
    )

    desktop_notifications = models.BooleanField(
        default=True,
    )

    push_notifications = models.BooleanField(
        default=True,
    )

    review_notifications = models.BooleanField(
        default=True,
    )

    task_notifications = models.BooleanField(
        default=True,
    )

    mention_notifications = models.BooleanField(
        default=True,
    )

    objects = UserPreferenceManager()

    class Meta:
        db_table = "identity_user_preference"

        ordering = ("user",)

        verbose_name = "User Preference"

        verbose_name_plural = "User Preferences"

    def __str__(self):
        return str(self.user)
