from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import PlatformScopedModel
from apps.identity.managers.rbac import UserPreferenceManager


class UserPreference(PlatformScopedModel):
    """
    User preferences and UI settings. Platform-global.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="identity_preferences",
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

    objects: UserPreferenceManager = UserPreferenceManager()

    class Meta:
        db_table = "identity_user_preference"

        ordering = ("user",)

    def __str__(self):
        return f"{self.user} Preferences"
