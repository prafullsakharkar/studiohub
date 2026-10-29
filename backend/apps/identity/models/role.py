from __future__ import annotations

from django.db import models
from django.db.models.functions import Lower

from apps.core.models import ColorModel, PlatformScopedModel
from apps.identity.choices import RolePriority, RoleScope, RoleType
from apps.identity.managers.rbac import RoleManager


class Role(PlatformScopedModel, ColorModel):
    """
    Platform-global authorization role.

    No organization FK: a role applies everywhere on the platform.
    """

    name = models.CharField(
        max_length=150,
    )

    code = models.SlugField(
        max_length=100,
        unique=True,
        db_index=True,
        blank=True,
    )

    description = models.TextField(
        blank=True,
    )

    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="children",
    )

    role_type = models.CharField(
        max_length=30,
        choices=RoleType.choices,
        default=RoleType.ORGANIZATION,
        db_index=True,
    )

    scope = models.CharField(
        max_length=30,
        choices=RoleScope.choices,
        default=RoleScope.ORGANIZATION,
        db_index=True,
    )

    priority = models.PositiveSmallIntegerField(
        choices=RolePriority.choices,
        default=RolePriority.MEMBER,
        db_index=True,
    )

    icon = models.CharField(
        max_length=50,
        blank=True,
    )

    is_system = models.BooleanField(
        default=False,
        db_index=True,
    )

    is_default = models.BooleanField(
        default=False,
        db_index=True,
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )

    sort_order = models.PositiveIntegerField(
        default=0,
    )

    objects: RoleManager = RoleManager()

    class Meta:
        db_table = "identity_role"

        ordering = (
            "priority",
            "sort_order",
            "name",
        )

        indexes = [
            models.Index(fields=["priority"]),
            models.Index(fields=["is_system"]),
            models.Index(fields=["is_default"]),
            models.Index(fields=["is_active"]),
        ]

        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                condition=models.Q(is_deleted=False),
                name="uq_identity_role_name_live",
            ),
        ]

    def __str__(self):
        return self.name
