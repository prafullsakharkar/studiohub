"""
Base models for the Master Data bounded context.

Platform-global catalogs (software, statuses, types). The organization
dimension was removed (org-removal plan): no organization FK, no
per-organization override models.
"""

from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases import EntityModel


class MasterDataScope(models.TextChoices):
    GLOBAL = "GLOBAL", _("Global")
    ORGANIZATION = "ORGANIZATION", _("Organization")


class CatalogModel(EntityModel):
    """Abstract platform catalog entry (no organization FK)."""

    code = models.CharField(
        _("Code"),
        max_length=100,
        unique=True,
        db_index=True,
    )
    name = models.CharField(
        _("Name"),
        max_length=255,
        db_index=True,
    )
    description = models.TextField(
        _("Description"),
        blank=True,
        default="",
    )
    status = models.CharField(
        _("Status"),
        max_length=20,
        default="active",
        db_index=True,
    )
    scope = models.CharField(
        _("Scope"),
        max_length=20,
        choices=MasterDataScope.choices,
        default=MasterDataScope.GLOBAL,
        db_index=True,
    )
    metadata = models.JSONField(
        _("Metadata"),
        default=dict,
        blank=True,
    )

    class Meta:
        abstract = True
        ordering = ("name",)
        indexes = [
            models.Index(fields=["scope", "status"]),
        ]

    def __str__(self):
        return self.name
