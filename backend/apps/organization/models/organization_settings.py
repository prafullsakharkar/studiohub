from django.db import models

from apps.organization.managers.organization_settings import (
    OrganizationSettingsManager,
)
from apps.organization.models.base import (
    OrganizationEntityModel,
)


class OrganizationSettings(OrganizationEntityModel):
    """
    Organization settings.
    """

    timezone = models.CharField(
        max_length=100,
        default="UTC",
    )

    language = models.CharField(
        max_length=20,
        default="en",
    )

    currency = models.CharField(
        max_length=10,
        default="USD",
    )

    date_format = models.CharField(
        max_length=30,
        default="YYYY-MM-DD",
    )

    time_format = models.CharField(
        max_length=20,
        default="24H",
    )

    week_start = models.PositiveSmallIntegerField(
        default=1,
    )

    fiscal_year_start = models.DateField(
        null=True,
        blank=True,
    )

    allow_remote_work = models.BooleanField(
        default=True,
    )

    allow_overtime = models.BooleanField(
        default=False,
    )

    objects = OrganizationSettingsManager()

    class Meta:
        db_table = "organization_settings"

        verbose_name = "Organization Settings"

        verbose_name_plural = "Organization Settings"
