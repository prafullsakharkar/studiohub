from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import EntityModel
from apps.organization.choices import InvitationStatus
from apps.organization.managers.membership import (
    OrganizationMembershipManager,
)


class OrganizationMembership(EntityModel):
    """
    A user's membership within an organization.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="organization_memberships",
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
        "organization.Role",
        on_delete=models.PROTECT,
        related_name="organization_memberships",
    )

    employee_id = models.CharField(
        max_length=50,
        blank=True,
    )

    employment_type = models.CharField(
        max_length=20,
        choices=[
            ("full_time", "Full Time"),
            ("part_time", "Part Time"),
            ("contractor", "Contractor"),
            ("intern", "Intern"),
            ("freelance", "Freelance"),
        ],
        default="full_time",
    )

    status = models.CharField(
        max_length=20,
        choices=[
            ("active", "Active"),
            ("on_leave", "On Leave"),
            ("terminated", "Terminated"),
            ("suspended", "Suspended"),
        ],
        default="active",
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

    objects = OrganizationMembershipManager()

    class Meta:
        db_table = "organization_membership"

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
