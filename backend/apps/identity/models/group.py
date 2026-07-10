from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import (
    AuditModel,
    ColorModel,
    MetadataModel,
    SoftDeleteModel,
    TimeStampedModel,
    UUIDModel,
)
from apps.identity.managers.group import (
    GroupManager,
)


class Group(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
    SoftDeleteModel,
    MetadataModel,
    ColorModel,
):
    """
    User Group.

    Used for RBAC and organizational grouping.
    """

    code = models.CharField(
        max_length=100,
        unique=True,
    )

    name = models.CharField(
        max_length=255,
    )

    description = models.TextField(
        blank=True,
    )

    is_system = models.BooleanField(
        default=False,
    )

    users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through="GroupMember",
        through_fields=("group", "user"),
        related_name="identity_groups",
    )

    objects = GroupManager()

    class Meta:
        db_table = "identity_group"

        ordering = ("name",)

    def __str__(self):
        return self.name
