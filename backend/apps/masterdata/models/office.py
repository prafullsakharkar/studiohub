"""
Global office reference model (org-removal B3).

Platform-global physical office location. No organization FK.
"""

from __future__ import annotations

from django.db import models
from django.db.models.functions import Lower
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases import PlatformScopedModel


class Office(PlatformScopedModel):
    """Physical office location in the platform directory."""

    code = models.CharField(_("Code"), max_length=30, db_index=True)
    name = models.CharField(_("Name"), max_length=255, db_index=True)
    description = models.TextField(_("Description"), blank=True, default="")

    office_type = models.CharField(_("Office type"), max_length=50)

    timezone = models.CharField(_("Timezone"), max_length=50)

    country = models.CharField(_("Country"), max_length=100)

    state = models.CharField(_("State"), max_length=100, blank=True, default="")

    city = models.CharField(_("City"), max_length=100)

    address = models.TextField(_("Address"), blank=True, default="")

    postal_code = models.CharField(_("Postal code"), max_length=20, blank=True, default="")

    phone = models.CharField(_("Phone"), max_length=30, blank=True, default="")

    email = models.EmailField(_("Email"), blank=True, default="")

    manager = models.ForeignKey(
        "masterdata.Person",
        null=True,
        blank=True,
        related_name="managed_offices",
        on_delete=models.SET_NULL,
    )

    working_hours = models.CharField(_("Working hours"), max_length=32, blank=True, default="")

    headcount = models.PositiveIntegerField(_("Headcount"), default=0)

    workstations_count = models.PositiveIntegerField(_("Workstations count"), default=0)

    render_nodes_count = models.PositiveIntegerField(_("Render nodes count"), default=0)

    is_active = models.BooleanField(_("Is active"), default=True)

    is_headquarters = models.BooleanField(_("Is headquarters"), default=False)

    class Meta:
        db_table = "masterdata_office"
        ordering = ("name",)
        indexes = [
            models.Index(fields=["city"]),
            models.Index(fields=["country"]),
            models.Index(fields=["code"]),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                condition=models.Q(is_deleted=False),
                name="masterdata_office_uq_code_ci",
            ),
            models.UniqueConstraint(
                Lower("name"),
                condition=models.Q(is_deleted=False),
                name="masterdata_office_uq_name_ci",
            ),
            models.UniqueConstraint(
                fields=["is_headquarters"],
                condition=models.Q(is_headquarters=True, is_deleted=False),
                name="masterdata_office_one_headquarters",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.city})"
