from __future__ import annotations

from django.db import models

from apps.core.models import (
    AuditModel,
    SoftDeleteModel,
    TimeStampedModel,
    UUIDModel,
)
from apps.identity.managers.group_role import (
    GroupRoleManager,
)


class GroupRole(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
    SoftDeleteModel,
):
    """
    Assigns a Role to a Group.
    """

    group = models.ForeignKey(
        "identity.Group",
        on_delete=models.CASCADE,
        related_name="group_roles",
    )

    role = models.ForeignKey(
        "identity.Role",
        on_delete=models.CASCADE,
        related_name="role_groups",
    )

    objects = GroupRoleManager()

    class Meta:
        db_table = "identity_group_role"

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
                name="uq_group_role",
            ),
        ]

    def __str__(self):
        return f"{self.group} → {self.role}"
