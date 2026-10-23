"""
Global team reference model.

Platform-global team under a department. No organization FK.
"""

from __future__ import annotations

from django.db import models
from django.db.models.functions import Lower
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases import PlatformScopedModel


class Team(PlatformScopedModel):
    """Team under a department."""

    code = models.CharField(_("Code"), max_length=30, db_index=True)
    name = models.CharField(_("Name"), max_length=255, db_index=True)
    description = models.TextField(_("Description"), blank=True, default="")

    department = models.ForeignKey(
        "masterdata.Department",
        on_delete=models.PROTECT,
        related_name="teams",
    )

    lead = models.ForeignKey(
        "masterdata.Person",
        null=True,
        blank=True,
        related_name="led_teams",
        on_delete=models.SET_NULL,
    )

    focus_discipline = models.CharField(
        _("Focus discipline"), max_length=64, blank=True, default=""
    )

    current_project_code = models.CharField(
        _("Current project code"), max_length=16, blank=True, default=""
    )

    utilization_percentage = models.FloatField(_("Utilization percentage"), default=0)

    color = models.CharField(_("Color"), max_length=20, blank=True, default="")

    capacity = models.PositiveIntegerField(_("Capacity"), default=1)

    class Meta:
        db_table = "masterdata_team"
        ordering = ("name",)
        indexes = [
            models.Index(fields=["department"]),
            models.Index(fields=["code"]),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                condition=models.Q(is_deleted=False),
                name="masterdata_team_uq_code_ci",
            ),
            models.UniqueConstraint(
                Lower("name"),
                condition=models.Q(is_deleted=False),
                name="masterdata_team_uq_name_ci",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"
