"""
Global position reference model (org-removal B3).

Platform-global job position. Canonical merge of the organization-scoped
``Position`` and the deleted ``PlatformPosition`` admin taxonomy: a single
global record with an optional department link. No organization FK, no
scope flag.
"""

from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases import PlatformScopedModel


class Position(PlatformScopedModel):
    """Platform job position."""

    code = models.CharField(_("Code"), max_length=30, unique=True, db_index=True)
    name = models.CharField(_("Name"), max_length=255, db_index=True)
    description = models.TextField(_("Description"), blank=True, default="")

    department = models.ForeignKey(
        "masterdata.Department",
        on_delete=models.SET_NULL,
        related_name="positions",
        null=True,
        blank=True,
    )

    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="children",
        null=True,
        blank=True,
    )

    level = models.PositiveIntegerField(_("Level"), default=1)

    is_managerial = models.BooleanField(_("Is managerial"), default=False)

    band_level = models.CharField(_("Band level"), max_length=50, blank=True, default="")

    salary_range = models.CharField(_("Salary range"), max_length=50, blank=True, default="")

    employment_type = models.CharField(_("Employment type"), max_length=30, blank=True, default="")

    class Meta:
        db_table = "masterdata_position"
        ordering = ("level", "name")

    def __str__(self):
        return f"{self.name} ({self.code})"
