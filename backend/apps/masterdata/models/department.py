"""
Global department reference model (org-removal B3).

Platform-global organizational unit. No organization FK: departments are
shared platform reference data consumed by production (teams, positions,
people link here).
"""

from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases import PlatformScopedModel


class DepartmentType(models.TextChoices):
    PRODUCTION = "production", _("Production")
    CREATIVE = "creative", _("Creative")
    TECHNICAL = "technical", _("Technical")
    SUPPORT = "support", _("Support")
    ADMINISTRATION = "administration", _("Administration")


class Department(PlatformScopedModel):
    """Department within the platform directory."""

    code = models.CharField(_("Code"), max_length=30, unique=True, db_index=True)
    name = models.CharField(_("Name"), max_length=255, db_index=True)
    description = models.TextField(_("Description"), blank=True, default="")

    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        related_name="children",
        on_delete=models.PROTECT,
    )

    department_type = models.CharField(
        _("Department type"),
        max_length=30,
        choices=DepartmentType.choices,
    )

    manager = models.ForeignKey(
        "masterdata.Person",
        null=True,
        blank=True,
        related_name="managed_departments",
        on_delete=models.SET_NULL,
    )

    color = models.CharField(_("Color"), max_length=20, blank=True, default="")

    software_stack = models.JSONField(_("Software stack"), default=list, blank=True)

    capacity_hours_weekly = models.PositiveIntegerField(_("Capacity hours weekly"), default=160)

    utilization_percentage = models.FloatField(_("Utilization percentage"), default=0)

    class Meta:
        db_table = "masterdata_department"
        ordering = ("name",)
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["parent"]),
            models.Index(fields=["name"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"
