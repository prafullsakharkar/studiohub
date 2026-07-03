from django.db import models


class DeviceInformationModel(models.Model):
    """
    Device and client application information.
    """

    device_name = models.CharField(
        max_length=255,
        blank=True,
    )

    device_type = models.CharField(
        max_length=50,
        blank=True,
    )

    browser = models.CharField(
        max_length=100,
        blank=True,
    )

    browser_version = models.CharField(
        max_length=50,
        blank=True,
    )

    operating_system = models.CharField(
        max_length=100,
        blank=True,
    )

    operating_system_version = models.CharField(
        max_length=50,
        blank=True,
    )

    user_agent = models.TextField(
        blank=True,
    )

    class Meta:
        abstract = True
