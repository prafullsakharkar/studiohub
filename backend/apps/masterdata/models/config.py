"""
Per-organization overrides of platform catalog rows.

Override *text* fields are nullable by design: NULL means "inherit the
catalog default", while an empty string is an explicit empty override.
This tri-state is load-bearing — do not collapse it to blank-only
(DJ001 is waived per field below for this reason).
"""

from __future__ import annotations

from django.db import models

from apps.masterdata.models.base import OrgConfigModel


class OrganizationSoftwareConfig(OrgConfigModel):
    software = models.ForeignKey(
        "masterdata.Software",
        on_delete=models.CASCADE,
        related_name="org_configs",
        db_index=True,
    )
    display_name_override = models.CharField(max_length=255, null=True, blank=True)  # noqa: DJ001
    category_override = models.CharField(max_length=100, null=True, blank=True)  # noqa: DJ001
    metadata_override = models.JSONField(null=True, blank=True)
    default_version = models.ForeignKey(
        "masterdata.SoftwareVersion",
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
        blank=True,
    )
    allowed_version_ids = models.JSONField(null=True, blank=True)
    executable_paths = models.JSONField(null=True, blank=True)
    environment_variables = models.JSONField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "masterdata_org_software_config"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "software"],
                name="uq_org_software_config",
            ),
        ]


class OrganizationStatusConfig(OrgConfigModel):
    status_item = models.ForeignKey(
        "masterdata.MasterStatus",
        on_delete=models.CASCADE,
        related_name="org_configs",
        db_index=True,
    )
    name_override = models.CharField(max_length=255, null=True, blank=True)  # noqa: DJ001
    color_override = models.CharField(max_length=20, null=True, blank=True)  # noqa: DJ001
    order_override = models.PositiveIntegerField(null=True, blank=True)
    is_default_override = models.BooleanField(null=True, blank=True)

    class Meta:
        db_table = "masterdata_org_status_config"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "status_item"],
                name="uq_org_status_config",
            ),
        ]


class OrganizationTaskTypeConfig(OrgConfigModel):
    task_type = models.ForeignKey(
        "masterdata.MasterTaskType",
        on_delete=models.CASCADE,
        related_name="org_configs",
        db_index=True,
    )
    name_override = models.CharField(max_length=255, null=True, blank=True)  # noqa: DJ001
    description_override = models.TextField(null=True, blank=True)  # noqa: DJ001
    color_override = models.CharField(max_length=20, null=True, blank=True)  # noqa: DJ001
    department_code_override = models.CharField(max_length=50, null=True, blank=True)  # noqa: DJ001

    class Meta:
        db_table = "masterdata_org_tasktype_config"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "task_type"],
                name="uq_org_tasktype_config",
            ),
        ]


class OrganizationAssetTypeConfig(OrgConfigModel):
    asset_type = models.ForeignKey(
        "masterdata.MasterAssetType",
        on_delete=models.CASCADE,
        related_name="org_configs",
        db_index=True,
    )
    name_override = models.CharField(max_length=255, null=True, blank=True)  # noqa: DJ001

    class Meta:
        db_table = "masterdata_org_assettype_config"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "asset_type"],
                name="uq_org_assettype_config",
            ),
        ]


class OrganizationShotTypeConfig(OrgConfigModel):
    shot_type = models.ForeignKey(
        "masterdata.MasterShotType",
        on_delete=models.CASCADE,
        related_name="org_configs",
        db_index=True,
    )
    name_override = models.CharField(max_length=255, null=True, blank=True)  # noqa: DJ001
    default_handle_frames_override = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        db_table = "masterdata_org_shottype_config"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "shot_type"],
                name="uq_org_shottype_config",
            ),
        ]


class OrganizationReviewTypeConfig(OrgConfigModel):
    review_type = models.ForeignKey(
        "masterdata.MasterReviewType",
        on_delete=models.CASCADE,
        related_name="org_configs",
        db_index=True,
    )
    name_override = models.CharField(max_length=255, null=True, blank=True)  # noqa: DJ001
    allow_verdicts_override = models.BooleanField(null=True, blank=True)
    require_notes_override = models.BooleanField(null=True, blank=True)

    class Meta:
        db_table = "masterdata_org_reviewtype_config"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "review_type"],
                name="uq_org_reviewtype_config",
            ),
        ]
