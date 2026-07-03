from django.db import models

from apps.organization.choices import HolidayType
from apps.organization.managers.holiday import HolidayManager
from apps.organization.models.base import OrganizationEntityModel


class Holiday(OrganizationEntityModel):
    """
    Organization holiday.
    """

    work_calendar = models.ForeignKey(
        "organization.WorkCalendar",
        on_delete=models.CASCADE,
        related_name="holidays",
    )

    date = models.DateField()

    holiday_type = models.CharField(
        max_length=30,
        choices=HolidayType.choices,
    )

    is_paid = models.BooleanField(
        default=True,
    )

    is_recurring = models.BooleanField(
        default=False,
    )

    objects = HolidayManager()

    class Meta:
        db_table = "organization_holiday"

        ordering = (
            "date",
            "name",
        )
