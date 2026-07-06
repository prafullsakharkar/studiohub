from django.db import models

from apps.organization.managers.calendar import (
    CalendarManager,
)
from apps.organization.models.base import (
    OrganizationEntityModel,
)


class Calendar(OrganizationEntityModel):
    """
    Organization event calendar.
    """

    color = models.CharField(
        max_length=20,
        blank=True,
    )

    description = models.TextField(
        blank=True,
    )

    is_default = models.BooleanField(
        default=False,
    )

    is_public = models.BooleanField(
        default=False,
    )

    objects = CalendarManager()

    class Meta:
        db_table = "organization_calendar"

        ordering = ("name",)
