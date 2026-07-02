from django.conf import settings
from django.db import models

from apps.organization.managers.office import OfficeManager
from apps.organization.models.base import OrganizationEntityModel


class Office(OrganizationEntityModel):
    """
    Physical office location of an organization.
    """

    office_type = models.CharField(
        max_length=50,
    )

    timezone = models.CharField(
        max_length=50,
    )

    country = models.CharField(
        max_length=100,
    )

    state = models.CharField(
        max_length=100,
        blank=True,
    )

    city = models.CharField(
        max_length=100,
    )

    address = models.TextField(
        blank=True,
    )

    postal_code = models.CharField(
        max_length=20,
        blank=True,
    )

    phone = models.CharField(
        max_length=30,
        blank=True,
    )

    email = models.EmailField(
        blank=True,
    )

    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="managed_offices",
        on_delete=models.SET_NULL,
    )

    is_headquarters = models.BooleanField(
        default=False,
    )

    objects = OfficeManager()

    class Meta:
        db_table = "org_office"

        ordering = ("name",)

        indexes = [
            models.Index(fields=["organization", "city"]),
            models.Index(fields=["organization", "country"]),
            models.Index(fields=["organization", "code"]),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"],
                name="uniq_office_code_per_org",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.city})"
