from django.db import models

from apps.organization.choices.event_type import CalendarEventType
from apps.organization.managers.calendar_event import CalendarEventManager
from apps.organization.models.base import OrganizationEntityModel


class CalendarEvent(OrganizationEntityModel):
    """
    Scheduled studio event on an organization's calendar
    (milestones, maintenance windows, turnovers, general events).
    """

    date = models.DateField()

    event_type = models.CharField(
        max_length=30,
        choices=CalendarEventType.choices,
        default=CalendarEventType.GENERAL,
    )

    office_name = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    all_day = models.BooleanField(
        default=False,
    )

    objects: CalendarEventManager = CalendarEventManager()

    class Meta:
        db_table = "organization_calendar_event"

        ordering = ("date", "name")

        indexes = [
            models.Index(fields=["organization", "date"]),
            models.Index(fields=["organization", "code"]),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"],
                name="uniq_calendar_event_code_per_org",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.date})"
