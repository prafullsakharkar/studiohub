from django.db import models

from apps.organization.managers.work_hours import (
    WorkHoursManager,
)
from apps.organization.models.base import (
    OrganizationEntityModel,
)


class WorkHours(OrganizationEntityModel):
    """
    Working hours definition.
    """

    work_calendar = models.ForeignKey(
        "organization.WorkCalendar",
        on_delete=models.CASCADE,
        related_name="work_hours",
    )

    day = models.PositiveSmallIntegerField()

    start_time = models.TimeField()

    end_time = models.TimeField()

    break_start = models.TimeField(
        blank=True,
        null=True,
    )

    break_end = models.TimeField(
        blank=True,
        null=True,
    )

    is_working_day = models.BooleanField(
        default=True,
    )

    objects = WorkHoursManager()

    class Meta:
        db_table = "organization_work_hours"

        ordering = ("day",)

        unique_together = (
            "work_calendar",
            "day",
        )
