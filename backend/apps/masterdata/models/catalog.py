"""
Platform catalog models (software, statuses, types).
"""

from __future__ import annotations

from datetime import date

from django.db import models
from django.db.models.functions import Lower
from django.utils.translation import gettext_lazy as _

from apps.masterdata.models.base import CatalogStatus, LookupCatalogModel
from apps.masterdata.versioning import KEY_MAX_LENGTH, natural_version_key


class Software(LookupCatalogModel):
    """DCC software / tool catalog entry."""

    publisher = models.CharField(_("Publisher"), max_length=255, blank=True, default="")
    category = models.CharField(_("Category"), max_length=100, blank=True, default="")
    website = models.URLField(_("Website"), blank=True, default="")

    class Meta(LookupCatalogModel.Meta):
        db_table = "masterdata_software"


class SoftwareVersion(LookupCatalogModel):
    """Version of a catalog software entry (DOM-MD-SW)."""

    # PROTECT: a hard delete of a software with versions is refused; a soft
    # delete cascades to its versions in the service.
    software = models.ForeignKey(
        Software,
        on_delete=models.PROTECT,
        related_name="versions",
        db_index=True,
    )
    version = models.CharField(_("Version"), max_length=50, db_index=True)
    version_code = models.CharField(_("Version code"), max_length=100, blank=True, default="")
    release_date = models.DateField(_("Release date"), null=True, blank=True)
    end_of_support = models.DateField(_("End of support"), null=True, blank=True)
    # Derived from ``version`` on save; lets the database sort 10 after 9.
    version_key = models.CharField(
        _("Version sort key"),
        max_length=KEY_MAX_LENGTH,
        blank=True,
        default="",
        editable=False,
        db_index=True,
    )

    class Meta(LookupCatalogModel.Meta):
        db_table = "masterdata_software_version"
        # Newest release first, undated last, then the natural version order.
        ordering = (
            models.F("release_date").desc(nulls_last=True),
            "-version_key",
            "version",
        )
        indexes = [
            models.Index(fields=["software", "status"]),
        ]
        # Code, name and version are unique *per software*, not globally.
        constraints = [
            models.UniqueConstraint(
                models.F("software"),
                Lower("code"),
                condition=models.Q(is_deleted=False),
                name="masterdata_softwareversion_uq_code_ci",
            ),
            models.UniqueConstraint(
                models.F("software"),
                Lower("name"),
                condition=models.Q(is_deleted=False),
                name="masterdata_softwareversion_uq_name_ci",
            ),
            models.UniqueConstraint(
                models.F("software"),
                Lower("version"),
                condition=models.Q(is_deleted=False),
                name="masterdata_softwareversion_uq_version_ci",
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=CatalogStatus.values),
                name="masterdata_softwareversion_status_valid",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(end_of_support__isnull=True)
                    | models.Q(release_date__isnull=True)
                    | models.Q(end_of_support__gte=models.F("release_date"))
                ),
                name="masterdata_softwareversion_support_after_release",
            ),
        ]

    def save(self, *args, **kwargs):
        self.version_key = natural_version_key(self.version)
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and "version" in update_fields:
            kwargs["update_fields"] = {*update_fields, "version_key"}
        super().save(*args, **kwargs)

    @property
    def is_deprecated(self) -> bool:
        """Archived, or past its end of support (DOM-MD-SW-05)."""
        if self.status == CatalogStatus.ARCHIVED:
            return True
        return self.end_of_support is not None and self.end_of_support < date.today()


class StatusEntityType(models.TextChoices):
    """Entities a workflow status can be assigned to (DOM-MD-STS-02)."""

    PROJECT = "Project", _("Project")
    SEQUENCE = "Sequence", _("Sequence")
    SHOT = "Shot", _("Shot")
    ASSET = "Asset", _("Asset")
    TASK = "Task", _("Task")
    VERSION = "Version", _("Version")
    REVIEW = "Review", _("Review")
    DELIVERY = "Delivery", _("Delivery")


class StatusCategory(models.TextChoices):
    """Coarse workflow stage a status belongs to (DOM-MD-STS-03)."""

    NOT_STARTED = "not_started", _("Not started")
    IN_PROGRESS = "in_progress", _("In progress")
    REVIEW = "review", _("Review")
    DONE = "done", _("Done")
    CANCELLED = "cancelled", _("Cancelled")


class MasterStatus(LookupCatalogModel):
    """Workflow-aware status definition for an entity type."""

    # Statuses are ordered by ``order`` (frontend contract), not ``sort_order``.
    sort_order = None

    entity_type = models.CharField(
        _("Entity type"),
        max_length=50,
        choices=StatusEntityType.choices,
        db_index=True,
    )
    category = models.CharField(
        _("Category"),
        max_length=50,
        choices=StatusCategory.choices,
        blank=True,
        default="",
    )
    color = models.CharField(_("Color"), max_length=20, blank=True, default="")
    order = models.PositiveIntegerField(_("Order"), default=0)
    is_default = models.BooleanField(_("Is default"), default=False)
    is_final = models.BooleanField(_("Is final"), default=False)

    class Meta:
        db_table = "masterdata_status"
        ordering = ("order", "name")
        indexes = [
            models.Index(fields=["entity_type", "order"]),
        ]
        constraints = [
            # Same code may exist for different entity types (DOM-MD-STS-01).
            models.UniqueConstraint(
                models.F("entity_type"),
                Lower("code"),
                condition=models.Q(is_deleted=False),
                name="masterdata_status_uq_code_ci",
            ),
            models.UniqueConstraint(
                models.F("entity_type"),
                Lower("name"),
                condition=models.Q(is_deleted=False),
                name="masterdata_status_uq_name_ci",
            ),
            # At most one live, active default per entity type (DOM-MD-STS-04).
            models.UniqueConstraint(
                fields=["entity_type"],
                condition=models.Q(is_default=True, is_deleted=False, status=CatalogStatus.ACTIVE),
                name="masterdata_status_one_default",
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=CatalogStatus.values),
                name="masterdata_status_status_valid",
            ),
        ]


class MasterTaskType(LookupCatalogModel):
    """Task type catalog entry."""

    category = models.CharField(_("Category"), max_length=50, blank=True, default="")
    department_code = models.CharField(_("Department code"), max_length=50, blank=True, default="")
    department_name = models.CharField(_("Department name"), max_length=255, blank=True, default="")
    color = models.CharField(_("Color"), max_length=20, blank=True, default="")
    icon = models.CharField(_("Icon"), max_length=100, blank=True, default="")

    class Meta(LookupCatalogModel.Meta):
        db_table = "masterdata_task_type"


class MasterAssetType(LookupCatalogModel):
    """Asset type catalog entry."""

    color = models.CharField(_("Color"), max_length=20, blank=True, default="")
    icon = models.CharField(_("Icon"), max_length=100, blank=True, default="")

    class Meta(LookupCatalogModel.Meta):
        db_table = "masterdata_asset_type"


class MasterShotType(LookupCatalogModel):
    """Shot type catalog entry."""

    default_handle_frames = models.PositiveIntegerField(
        _("Default handle frames"), null=True, blank=True
    )

    class Meta(LookupCatalogModel.Meta):
        db_table = "masterdata_shot_type"


class MasterReviewType(LookupCatalogModel):
    """Review type catalog entry."""

    allow_verdicts = models.BooleanField(_("Allow verdicts"), default=True)
    require_notes = models.BooleanField(_("Require notes"), default=False)

    class Meta(LookupCatalogModel.Meta):
        db_table = "masterdata_review_type"


class MasterFileType(LookupCatalogModel):
    """File type / format catalog entry."""

    extension = models.CharField(_("Extension"), max_length=20, blank=True, default="")
    mime_type = models.CharField(_("MIME type"), max_length=100, blank=True, default="")
    category = models.CharField(_("Category"), max_length=50, blank=True, default="")
    dcc_affinity = models.CharField(_("DCC affinity"), max_length=100, blank=True, default="")

    class Meta(LookupCatalogModel.Meta):
        db_table = "masterdata_file_type"
