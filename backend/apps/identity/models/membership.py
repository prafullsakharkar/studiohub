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
    EmploymentType,
    MembershipStatus,
)
from apps.identity.managers.membership import (
    MembershipManager,
)


class OrganizationMembership(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
    SoftDeleteModel,
    MetadataModel,
):
    """
    A user's membership within an organization.
    """

    user = models.ForeignKey(
        "identity.User",
        on_delete=models.CASCADE,
        related_name="memberships",
    )

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="memberships",
    )

    department = models.ForeignKey(
        "organization.Department",
        on_delete=models.SET_NULL,
        related_name="memberships",
        null=True,
        blank=True,
    )

    team = models.ForeignKey(
        "organization.Team",
        on_delete=models.SET_NULL,
        related_name="memberships",
        null=True,
        blank=True,
    )

    office = models.ForeignKey(
        "organization.Office",
        on_delete=models.SET_NULL,
        related_name="memberships",
        null=True,
        blank=True,
    )

    role = models.ForeignKey(
        "identity.Role",
        on_delete=models.PROTECT,
        related_name="memberships",
    )

    employee_id = models.CharField(
        max_length=50,
        blank=True,
    )

    employment_type = models.CharField(
        max_length=20,
        choices=EmploymentType.choices,
        default=EmploymentType.FULL_TIME,
    )

    status = models.CharField(
        max_length=20,
        choices=MembershipStatus.choices,
        default=MembershipStatus.ACTIVE,
    )

    joined_at = models.DateField(
        null=True,
        blank=True,
    )

    left_at = models.DateField(
        null=True,
        blank=True,
    )

    is_primary = models.BooleanField(
        default=False,
        db_index=True,
    )

    objects = MembershipManager()

    class Meta:
        db_table = "identity_memberships"

        ordering = (
            "organization",
            "user",
        )

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "user",
                    "organization",
                ],
                name="uq_user_organization_membership",
            )
        ]

    def __str__(self):
        return f"{self.user} @ {self.organization}"
