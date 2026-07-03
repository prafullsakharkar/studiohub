from __future__ import annotations

import uuid

from django.db import models

from apps.core.models import (
    AuditModel,
    MetadataModel,
    SoftDeleteModel,
    TimeStampedModel,
    UUIDModel,
)
from apps.identity.choices import (
    InvitationStatus,
    InvitationType,
)
from apps.identity.managers.invitation import (
    InvitationManager,
)


class Invitation(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
    SoftDeleteModel,
    MetadataModel,
):
    """
    Invitation to join an organization.
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="invitations",
    )

    department = models.ForeignKey(
        "organization.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invitations",
    )

    team = models.ForeignKey(
        "organization.Team",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invitations",
    )

    office = models.ForeignKey(
        "organization.Office",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invitations",
    )

    role = models.ForeignKey(
        "identity.Role",
        on_delete=models.PROTECT,
        related_name="invitations",
    )

    invited_by = models.ForeignKey(
        "identity.User",
        on_delete=models.PROTECT,
        related_name="sent_invitations",
    )

    email = models.EmailField(
        db_index=True,
    )

    token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
    )

    invitation_type = models.CharField(
        max_length=20,
        choices=InvitationType.choices,
        default=InvitationType.ORGANIZATION,
    )

    status = models.CharField(
        max_length=20,
        choices=InvitationStatus.choices,
        default=InvitationStatus.PENDING,
    )

    expires_at = models.DateTimeField()

    accepted_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    message = models.TextField(
        blank=True,
    )

    objects = InvitationManager()

    class Meta:
        db_table = "identity_invitations"

        ordering = ("-created_at",)

        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["status"]),
            models.Index(fields=["token"]),
            models.Index(fields=["expires_at"]),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "organization",
                    "email",
                    "status",
                ],
                condition=models.Q(status="pending"),
                name="uq_pending_invitation_per_org_email",
            )
        ]

    def __str__(self):
        return f"{self.email} → {self.organization}"
