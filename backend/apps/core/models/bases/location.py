from django.db import models


class GeoLocationModel(models.Model):
    """
    Geographical information derived from IP or other trusted sources.
    """

    country = models.CharField(
        max_length=100,
        blank=True,
    )

    region = models.CharField(
        max_length=100,
        blank=True,
    )

    city = models.CharField(
        max_length=100,
        blank=True,
    )

    timezone = models.CharField(
        max_length=100,
        blank=True,
    )

    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
    )

    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
    )

    class Meta:
        abstract = True
