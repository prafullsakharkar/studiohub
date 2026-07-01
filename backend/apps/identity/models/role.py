from __future__ import annotations

from django.db import models

from apps.core.models import (
    AuditModel,
    ColorModel,
    MetadataModel,
    SoftDeleteModel,
    TimeStampedModel,
    UUIDModel,
)
from apps.identity.choices import RolePriority, RoleScope, RoleType
from apps.identity.managers.role import RoleManager


class Role(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
    SoftDeleteModel,
    MetadataModel,
    ColorModel,
):
    """
    Authorization role.
    """

    name = models.CharField(
        max_length=150,
    )

    code = models.SlugField(
        max_length=100,
        unique=True,
        db_index=True,
    )

    description = models.TextField(
        blank=True,
    )

    organization = models.ForeignKey(
        "organization.Organization",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="roles",
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
        default=RolePriority.ARTIST,
        db_index=True,
    )

    icon = models.CharField(
        max_length=50,
        blank=True,
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

    objects = RoleManager()

    class Meta:
        db_table = "identity_roles"

        ordering = (
            "priority",
            "sort_order",
            "name",
        )

        indexes = [
            models.Index(fields=["organization"]),
            models.Index(fields=["priority"]),
            models.Index(fields=["is_system"]),
            models.Index(fields=["is_default"]),
            models.Index(fields=["is_active"]),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "organization",
                    "code",
                ],
                name="uq_role_org_code",
            )
        ]

    def __str__(self):
        return self.name
