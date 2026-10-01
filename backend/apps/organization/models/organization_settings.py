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

    # Pipeline defaults read by the frontend (studio settings + project
    # creation). Added to the model with DB-matching types/defaults after
    # these columns were found live in production schema without a model
    # counterpart — bare creates (tenant provisioning) 500/409d on their
    # NOT NULL constraints.
    allow_guest_reviewers = models.BooleanField(
        default=False,
    )

    enable_two_factor = models.BooleanField(
        default=False,
    )

    sso_enforced = models.BooleanField(
        default=False,
    )

    default_fps = models.FloatField(
        default=24.0,
    )

    default_color_space = models.CharField(
        max_length=64,
        default="ACEScg",
    )

    default_resolution = models.CharField(
        max_length=64,
        default="1920x1080",
        blank=True,
    )

    usd_schema_version = models.CharField(
        max_length=64,
        default="24.08",
        blank=True,
    )

    render_farm_region = models.CharField(
        max_length=255,
        default="",
        blank=True,
    )

    objects: OrganizationSettingsManager = OrganizationSettingsManager()

    class Meta:
        db_table = "organization_organization_settings"

        verbose_name = "Organization Settings"

        verbose_name_plural = "Organization Settings"
