from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import EntityModel
from apps.organization.managers.user_role import (
    UserRoleManager,
)


class UserRole(EntityModel):
    """
    Assigns a Role to a User.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="organization_user_roles",
    )

    role = models.ForeignKey(
        "organization.Role",
        on_delete=models.CASCADE,
        related_name="role_users",
    )

    objects = UserRoleManager()

    class Meta:
        db_table = "organization_user_role"

        ordering = (
            "user",
            "role",
        )

        constraints = [
            models.UniqueConstraint(
                fields=(
                    "user",
                    "role",
                ),
                name="uq_organization_user_role",
            ),
        ]

    def __str__(self):
        return f"{self.user} → {self.role}"
