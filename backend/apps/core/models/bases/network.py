from django.db import models


class NetworkInformationModel(models.Model):
    """
    Network level information.
    """

    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
    )

    isp = models.CharField(
        max_length=255,
        blank=True,
    )

    asn = models.CharField(
        max_length=100,
        blank=True,
    )

    network = models.CharField(
        max_length=255,
        blank=True,
    )

    is_proxy = models.BooleanField(
        default=False,
    )

    is_vpn = models.BooleanField(
        default=False,
    )

    class Meta:
        abstract = True
