"""
Invitation model for organization membership.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import EntityModel
from apps.organization.choices import InvitationStatus
from apps.organization.managers.invitation import (
    InvitationManager,
)


class Invitation(EntityModel):
    """
    Organization invitation for new members.

    Invitations allow existing organization members to invite
    new users to join the organization with specific roles.
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="invitations",
    )

    email = models.EmailField(
        db_index=True,
    )

    role = models.ForeignKey(
        "organization.Role",
        on_delete=models.PROTECT,
        related_name="invitations",
    )

    department = models.ForeignKey(
        "organization.Department",
        on_delete=models.SET_NULL,
        related_name="invitations",
        null=True,
        blank=True,
    )

    team = models.ForeignKey(
        "organization.Team",
        on_delete=models.SET_NULL,
        related_name="invitations",
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=InvitationStatus.choices,
        default=InvitationStatus.PENDING,
        db_index=True,
    )

    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_invitations",
    )

    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="accepted_invitations",
        null=True,
        blank=True,
    )

    expires_at = models.DateTimeField()

    accepted_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    declined_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    cancelled_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    resent_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    objects = InvitationManager()

    class Meta:
        db_table = "organization_invitation"

        ordering = ("-created_at",)

        indexes = [
            models.Index(fields=["organization", "email"]),
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["expires_at"]),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["organization", "email"],
                condition=models.Q(status=InvitationStatus.PENDING),
                name="uniq_invitation_per_org_email",
            ),
        ]

    def __str__(self):
        return f"Invitation for {self.email} to {self.organization}"

    @property
    def is_pending(self):
        return self.status == InvitationStatus.PENDING

    @property
    def is_accepted(self):
        return self.status == InvitationStatus.ACCEPTED

    @property
    def is_declined(self):
        return self.status == InvitationStatus.DECLINED

    @property
    def is_cancelled(self):
        return self.status == InvitationStatus.CANCELLED

    @property
    def is_expired(self):
        from django.utils import timezone

        return timezone.now() > self.expires_at

    def accept(self, user):
        """Accept the invitation."""
        from django.utils import timezone

        self.status = InvitationStatus.ACCEPTED
        self.accepted_by = user
        self.accepted_at = timezone.now()
        self.save(
            update_fields=[
                "status",
                "accepted_by",
                "accepted_at",
            ]
        )

    def decline(self, user):
        """Decline the invitation."""
        from django.utils import timezone

        self.status = InvitationStatus.DECLINED
        self.declined_at = timezone.now()
        self.save(
            update_fields=[
                "status",
                "declined_at",
            ]
        )

    def cancel(self):
        """Cancel the invitation."""
        from django.utils import timezone

        self.status = InvitationStatus.CANCELLED
        self.cancelled_at = timezone.now()
        self.save(
            update_fields=[
                "status",
                "cancelled_at",
            ]
        )

    def expire(self):
        """Expire the invitation."""

        self.status = InvitationStatus.EXPIRED
        self.save(update_fields=["status"])

    def resend(self):
        """Resend the invitation."""
        from django.utils import timezone

        self.status = InvitationStatus.PENDING
        self.resent_at = timezone.now()
        self.save(
            update_fields=[
                "status",
                "resent_at",
            ]
        )
