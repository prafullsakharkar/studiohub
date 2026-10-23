"""
Base models for the Master Data bounded context.

Platform-global catalogs (software, statuses, types). The organization
dimension was removed (org-removal plan): no organization FK, no
per-organization override models.
"""

from __future__ import annotations

from django.db import models
from django.db.models.functions import Lower
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases import EntityModel


class MasterDataScope(models.TextChoices):
    GLOBAL = "GLOBAL", _("Global")
    ORGANIZATION = "ORGANIZATION", _("Organization")


class CatalogStatus(models.TextChoices):
    """Lifecycle of a managed catalog row. Removal is soft delete, not a status."""

    ACTIVE = "active", _("Active")
    ARCHIVED = "archived", _("Archived")


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


class LookupCatalogModel(CatalogModel):
    """
    Managed lookup catalog (DOM-MD-COM / DOM-MD-CAT, docs/masterdata/CONTRACTS.md).

    Adds what the base lacks: case-insensitive uniqueness of ``code`` and
    ``name`` among live rows (so a soft-deleted code can be re-created or
    restored without a clash), an enum ``status``, ``is_system`` and
    ``sort_order``. Software and its versions still extend ``CatalogModel``
    and move here in Phase 4.
    """

    # Not unique at column level: uniqueness is the partial, case-insensitive
    # constraint below, which ignores soft-deleted rows.
    code = models.CharField(_("Code"), max_length=100, db_index=True)
    status = models.CharField(
        _("Status"),
        max_length=20,
        choices=CatalogStatus.choices,
        default=CatalogStatus.ACTIVE,
        db_index=True,
    )
    is_system = models.BooleanField(_("Is system"), default=False)
    sort_order = models.PositiveIntegerField(_("Sort order"), default=0)

    class Meta:
        abstract = True
        ordering = ("sort_order", "name")
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                condition=models.Q(is_deleted=False),
                name="%(app_label)s_%(class)s_uq_code_ci",
            ),
            models.UniqueConstraint(
                Lower("name"),
                condition=models.Q(is_deleted=False),
                name="%(app_label)s_%(class)s_uq_name_ci",
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=CatalogStatus.values),
                name="%(app_label)s_%(class)s_status_valid",
            ),
        ]
