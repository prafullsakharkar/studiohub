from django.db import models

from apps.organization.managers.position import (
    PositionManager,
)
from apps.organization.models.base import (
    OrganizationEntityModel,
)


class Position(OrganizationEntityModel):
    """
    Organization job position.
    """

    department = models.ForeignKey(
        "organization.Department",
        on_delete=models.SET_NULL,
        related_name="positions",
        null=True,
        blank=True,
    )

    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="children",
        null=True,
        blank=True,
    )

    level = models.PositiveIntegerField(
        default=1,
    )

    is_managerial = models.BooleanField(
        default=False,
    )

    objects = PositionManager()

    class Meta:
        db_table = "organization_position"

        ordering = (
            "level",
            "name",
        )
