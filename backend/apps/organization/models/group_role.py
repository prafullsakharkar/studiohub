from __future__ import annotations

from django.db import models

from apps.core.models import EntityModel
from apps.organization.managers.group_role import (
    GroupRoleManager,
)


class GroupRole(EntityModel):
    """
    Assigns a Role to a Group.
    """

    group = models.ForeignKey(
        "organization.Group",
        on_delete=models.CASCADE,
        related_name="group_roles",
    )

    role = models.ForeignKey(
        "organization.Role",
        on_delete=models.CASCADE,
        related_name="role_groups",
    )

    objects = GroupRoleManager()

    class Meta:
        db_table = "organization_group_role"

        ordering = (
            "group",
            "role",
        )

        constraints = [
            models.UniqueConstraint(
                fields=(
                    "group",
                    "role",
                ),
                name="uq_organization_group_role",
            ),
        ]

    def __str__(self):
        return f"{self.group} → {self.role}"
