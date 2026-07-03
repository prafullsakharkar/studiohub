from django.db import models


class ClientInformationModel(models.Model):
    """
    Information about the consuming client application.
    """

    application_name = models.CharField(
        max_length=100,
        blank=True,
    )

    application_version = models.CharField(
        max_length=50,
        blank=True,
    )

    platform = models.CharField(
        max_length=50,
        blank=True,
    )

    locale = models.CharField(
        max_length=20,
        blank=True,
    )

    class Meta:
        abstract = True
