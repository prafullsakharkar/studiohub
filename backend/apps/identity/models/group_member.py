from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import (
    AuditModel,
    MetadataModel,
    SoftDeleteModel,
    TimeStampedModel,
    UUIDModel,
)
from apps.identity.managers.group_member import (
    GroupMemberManager,
)


class GroupMember(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
    SoftDeleteModel,
    MetadataModel,
):
    """
    Membership between User and Group.
    """

    group = models.ForeignKey(
        "identity.Group",
        on_delete=models.CASCADE,
        related_name="memberships",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="group_memberships",
    )

    is_owner = models.BooleanField(
        default=False,
    )

    is_manager = models.BooleanField(
        default=False,
    )

    joined_at = models.DateTimeField(
        auto_now_add=True,
    )

    left_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    objects = GroupMemberManager()

    class Meta:
        db_table = "identity_group_member"

        ordering = (
            "group",
            "user",
        )

        constraints = [
            models.UniqueConstraint(
                fields=(
                    "group",
                    "user",
                ),
                name="uq_identity_group_member",
            ),
        ]

    def __str__(self):
        return f"{self.user} → {self.group}"
