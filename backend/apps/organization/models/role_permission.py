from django.conf import settings
from django.db import models

from apps.core.models import EntityModel
from apps.organization.managers.role_permission import (
    RolePermissionManager,
)


class RolePermission(EntityModel):

    role = models.ForeignKey(
        "organization.Role",
        on_delete=models.CASCADE,
        related_name="role_permissions",
    )

    permission = models.ForeignKey(
        "organization.Permission",
        on_delete=models.CASCADE,
        related_name="role_permissions",
    )

    granted = models.BooleanField(
        default=True,
    )

    granted_at = models.DateTimeField(
        auto_now_add=True,
    )

    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="granted_role_permissions",
    )

    expires_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    objects = RolePermissionManager()

    class Meta:

        db_table = "organization_role_permissions"

        ordering = [
            "role",
            "permission",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "role",
                    "permission",
                ],
                name="uq_organization_role_permission",
            )
        ]
