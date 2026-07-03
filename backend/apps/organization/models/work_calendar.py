from django.db import models

from apps.organization.managers.work_calendar import (
    WorkCalendarManager,
)
from apps.organization.models.base import (
    OrganizationEntityModel,
)


class WorkCalendar(OrganizationEntityModel):
    """
    Organization work calendar.
    """

    timezone = models.CharField(
        max_length=100,
    )

    working_days = models.JSONField(
        default=list,
        blank=True,
    )

    is_default = models.BooleanField(
        default=False,
    )

    objects = WorkCalendarManager()

    class Meta:
        db_table = "organization_work_calendar"

        ordering = ("name",)
