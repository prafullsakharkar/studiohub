from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models.functions import Lower

from apps.core.models import ColorModel, PlatformScopedModel
from apps.identity.managers.rbac import GroupManager


class Group(PlatformScopedModel, ColorModel):
    """
    Platform-global user Group.

    Used for RBAC grouping. No organization FK.
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

    objects: GroupManager = GroupManager()

    class Meta:
        db_table = "identity_group"

        ordering = ("name",)

        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                condition=models.Q(is_deleted=False),
                name="uq_identity_group_name_live",
            ),
        ]

    def __str__(self):
        return self.name
