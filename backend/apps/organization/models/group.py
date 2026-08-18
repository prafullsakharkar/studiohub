from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import ColorModel, EntityModel
from apps.organization.managers.group import (
    GroupManager,
)


class Group(EntityModel, ColorModel):
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

    organization = models.ForeignKey(
        "organization.Organization",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="groups",
    )

    users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through="GroupMember",
        through_fields=("group", "user"),
        related_name="organization_groups",
    )

    objects = GroupManager()

    class Meta:
        db_table = "organization_group"

        ordering = ("name",)

    def __str__(self):
        return self.name
