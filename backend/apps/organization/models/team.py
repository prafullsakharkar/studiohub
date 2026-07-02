from django.conf import settings
from django.db import models

from apps.organization.managers.team import TeamManager
from apps.organization.models.base import OrganizationEntityModel


class Team(OrganizationEntityModel):
    """
    Team under a Department.
    """

    department = models.ForeignKey(
        "organization.Department",
        on_delete=models.PROTECT,
        related_name="teams",
    )

    lead = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="led_teams",
        on_delete=models.SET_NULL,
    )

    color = models.CharField(
        max_length=20,
        blank=True,
    )

    capacity = models.PositiveIntegerField(
        default=1,
    )

    objects = TeamManager()

    class Meta:
        db_table = "org_team"

        ordering = ("name",)

        indexes = [
            models.Index(fields=["organization", "department"]),
            models.Index(fields=["organization", "code"]),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"],
                name="uniq_team_code_per_org",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"
