"""
Platform catalog models (software, statuses, types).
"""

from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.masterdata.models.base import CatalogModel


class Software(CatalogModel):
    """DCC software / tool catalog entry."""

    publisher = models.CharField(_("Publisher"), max_length=255, blank=True, default="")
    category = models.CharField(_("Category"), max_length=100, blank=True, default="")
    website = models.URLField(_("Website"), blank=True, default="")
    is_system = models.BooleanField(_("Is system"), default=False)

    class Meta:
        db_table = "masterdata_software"

    @property
    def version_count(self):
        return self.versions.exclude(status__iexact="archived").count()


class SoftwareVersion(CatalogModel):
    """Version of a catalog software entry."""

    software = models.ForeignKey(
        Software,
        on_delete=models.CASCADE,
        related_name="versions",
        db_index=True,
    )
    version = models.CharField(_("Version"), max_length=50, db_index=True)
    version_code = models.CharField(_("Version code"), max_length=100, blank=True, default="")
    release_date = models.DateField(_("Release date"), null=True, blank=True)
    end_of_support = models.DateField(_("End of support"), null=True, blank=True)

    class Meta:
        db_table = "masterdata_software_version"
        constraints = [
            models.UniqueConstraint(
                fields=["software", "version"],
                name="uq_software_version_per_software",
            ),
        ]
        indexes = [
            models.Index(fields=["software", "status"]),
        ]


class MasterStatus(CatalogModel):
    """Workflow-aware status definition for an entity type."""

    entity_type = models.CharField(_("Entity type"), max_length=50, db_index=True)
    category = models.CharField(_("Category"), max_length=50, blank=True, default="")
    color = models.CharField(_("Color"), max_length=20, blank=True, default="")
    order = models.PositiveIntegerField(_("Order"), default=0)
    is_default = models.BooleanField(_("Is default"), default=False)
    is_final = models.BooleanField(_("Is final"), default=False)

    class Meta:
        db_table = "masterdata_status"
        indexes = [
            models.Index(fields=["entity_type", "order"]),
        ]


class MasterTaskType(CatalogModel):
    """Task type catalog entry."""

    category = models.CharField(_("Category"), max_length=50, blank=True, default="")
    department_code = models.CharField(_("Department code"), max_length=50, blank=True, default="")
    department_name = models.CharField(_("Department name"), max_length=255, blank=True, default="")
    color = models.CharField(_("Color"), max_length=20, blank=True, default="")
    icon = models.CharField(_("Icon"), max_length=100, blank=True, default="")

    class Meta:
        db_table = "masterdata_task_type"


class MasterAssetType(CatalogModel):
    """Asset type catalog entry."""

    color = models.CharField(_("Color"), max_length=20, blank=True, default="")
    icon = models.CharField(_("Icon"), max_length=100, blank=True, default="")

    class Meta:
        db_table = "masterdata_asset_type"


class MasterShotType(CatalogModel):
    """Shot type catalog entry."""

    default_handle_frames = models.PositiveIntegerField(
        _("Default handle frames"), null=True, blank=True
    )

    class Meta:
        db_table = "masterdata_shot_type"


class MasterReviewType(CatalogModel):
    """Review type catalog entry."""

    allow_verdicts = models.BooleanField(_("Allow verdicts"), default=True)
    require_notes = models.BooleanField(_("Require notes"), default=False)

    class Meta:
        db_table = "masterdata_review_type"


class MasterFileType(CatalogModel):
    """File type / format catalog entry."""

    extension = models.CharField(_("Extension"), max_length=20, blank=True, default="")
    mime_type = models.CharField(_("MIME type"), max_length=100, blank=True, default="")
    category = models.CharField(_("Category"), max_length=50, blank=True, default="")
    dcc_affinity = models.CharField(_("DCC affinity"), max_length=100, blank=True, default="")

    class Meta:
        db_table = "masterdata_file_type"
