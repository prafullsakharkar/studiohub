from __future__ import annotations

from django.db import models

from apps.organization.managers.branding import BrandingManager
from apps.organization.models.base import OrganizationEntityModel


class Branding(OrganizationEntityModel):
    """
    Organization branding configuration.
    """

    logo = models.ImageField(
        upload_to="organizations/logos/",
        blank=True,
        null=True,
    )

    favicon = models.ImageField(
        upload_to="organizations/favicons/",
        blank=True,
        null=True,
    )

    primary_color = models.CharField(
        max_length=7,
        default="#1976D2",
    )

    secondary_color = models.CharField(
        max_length=7,
        default="#424242",
    )

    accent_color = models.CharField(
        max_length=7,
        default="#FF9800",
    )

    font_family = models.CharField(
        max_length=100,
        default="Inter",
    )

    theme = models.CharField(
        max_length=20,
        default="light",
    )

    objects = BrandingManager()

    class Meta:
        db_table = "organization_branding"

        verbose_name = "Branding"

        verbose_name_plural = "Branding"

    def __str__(self):
        return self.name
