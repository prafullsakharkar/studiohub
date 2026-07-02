from __future__ import annotations

from django.db import models


class BrandingModel(models.Model):
    """
    Branding information.
    """

    logo = models.ImageField(
        upload_to="branding/logos/",
        blank=True,
        null=True,
    )

    primary_color = models.CharField(
        max_length=7,
        blank=True,
    )

    secondary_color = models.CharField(
        max_length=7,
        blank=True,
    )

    icon = models.ImageField(
        upload_to="branding/icons/",
        blank=True,
        null=True,
    )

    class Meta:
        abstract = True
