from django.conf import settings
from django.db import models

from apps.core.models import PlatformScopedModel
from apps.identity.managers.rbac import RolePermissionManager


class RolePermission(PlatformScopedModel):
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
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="identity_granted_role_permissions",
    )

    expires_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    objects: RolePermissionManager = RolePermissionManager()

    class Meta:
        db_table = "identity_role_permission"

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
                name="uq_identity_role_permission",
            )
        ]
