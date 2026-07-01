from __future__ import annotations

from django.db import models

from apps.core.models import (
    AuditModel,
    MetadataModel,
    TimeStampedModel,
    UUIDModel,
)
from apps.identity.choices import (
    TIMEZONE_CHOICES,
    Language,
)
from apps.identity.managers import ProfileManager


class Profile(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
    MetadataModel,
):
    """
    User profile.
    """

    user = models.OneToOneField(
        "identity.User",
        on_delete=models.CASCADE,
        related_name="profile",
    )

    first_name = models.CharField(
        max_length=100,
    )

    last_name = models.CharField(
        max_length=100,
        blank=True,
    )

    display_name = models.CharField(
        max_length=255,
    )

    avatar = models.ImageField(
        upload_to="avatars/",
        blank=True,
        null=True,
    )

    phone = models.CharField(
        max_length=30,
        blank=True,
    )

    bio = models.TextField(
        blank=True,
    )

    timezone = models.CharField(
        max_length=64,
        choices=TIMEZONE_CHOICES,
        default="UTC",
    )

    language = models.CharField(
        max_length=10,
        choices=Language.choices,
        default=Language.ENGLISH,
    )

    preferences = models.JSONField(
        default=dict,
        blank=True,
    )

    objects = ProfileManager()

    class Meta:
        db_table = "identity_profiles"

    @property
    def full_name(self):

        return (f"{self.first_name} {self.last_name}").strip()

    def __str__(self):
        return self.display_name
