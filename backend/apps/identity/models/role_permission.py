from django.db import models

from apps.core.models import (
    AuditModel,
    MetadataModel,
    SoftDeleteModel,
    TimeStampedModel,
    UUIDModel,
)
from apps.identity.managers.role_permission import (
    RolePermissionManager,
)


class RolePermission(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
    SoftDeleteModel,
    MetadataModel,
):

    role = models.ForeignKey(
        "identity.Role",
        on_delete=models.CASCADE,
        related_name="role_permissions",
    )

    permission = models.ForeignKey(
        "identity.Permission",
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
        "identity.User",
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

        db_table = "identity_role_permissions"

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
                name="uq_role_permission",
            )
        ]
