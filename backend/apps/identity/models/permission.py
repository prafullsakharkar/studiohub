from __future__ import annotations

from django.db import models

from apps.core.models import (
    AuditModel,
    MetadataModel,
    SoftDeleteModel,
    TimeStampedModel,
    UUIDModel,
)
from apps.identity.choices import (
    PermissionAction,
    PermissionCategory,
    PermissionModule,
)
from apps.identity.managers.permission import (
    PermissionManager,
)


class Permission(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
    SoftDeleteModel,
    MetadataModel,
):
    """
    System permission.

    Example:
        project.view
        project.create
        shot.assign
        asset.publish
    """

    name = models.CharField(
        max_length=150,
    )

    code = models.CharField(
        max_length=150,
        unique=True,
        db_index=True,
    )

    module = models.CharField(
        max_length=50,
        choices=PermissionModule.choices,
        db_index=True,
    )

    action = models.CharField(
        max_length=50,
        choices=PermissionAction.choices,
        db_index=True,
    )

    category = models.CharField(
        max_length=50,
        choices=PermissionCategory.choices,
        db_index=True,
    )

    description = models.TextField(
        blank=True,
    )

    is_system = models.BooleanField(
        default=True,
        db_index=True,
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )

    sort_order = models.PositiveIntegerField(
        default=0,
    )

    objects = PermissionManager()

    class Meta:
        db_table = "identity_permissions"

        verbose_name = "Permission"

        verbose_name_plural = "Permissions"

        ordering = (
            "module",
            "sort_order",
            "name",
        )

        indexes = [
            models.Index(
                fields=["module"],
            ),
            models.Index(
                fields=["action"],
            ),
            models.Index(
                fields=["module", "action"],
            ),
            models.Index(
                fields=["is_system"],
            ),
            models.Index(
                fields=["is_active"],
            ),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "module",
                    "action",
                ],
                name="uq_permission_module_action",
            )
        ]

    def __str__(self):
        return self.name

    @property
    def display_name(self):
        return self.name

    @property
    def full_code(self):
        return self.code
