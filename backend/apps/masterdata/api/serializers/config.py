"""
Organization override serializers (frontend contract shapes).
"""

from __future__ import annotations

from rest_framework import serializers

from apps.masterdata.models import (
    OrganizationAssetTypeConfig,
    OrganizationReviewTypeConfig,
    OrganizationShotTypeConfig,
    OrganizationSoftwareConfig,
    OrganizationStatusConfig,
    OrganizationTaskTypeConfig,
)


class OrganizationSoftwareConfigSerializer(serializers.ModelSerializer[OrganizationSoftwareConfig]):
    software_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = OrganizationSoftwareConfig
        fields = (
            "id",
            "organization_id",
            "software_id",
            "enabled",
            "display_name_override",
            "category_override",
            "metadata_override",
            "default_version_id",
            "allowed_version_ids",
            "executable_paths",
            "environment_variables",
            "notes",
            "updated_at",
        )
        read_only_fields = ("id", "organization_id", "software_id", "updated_at")


class OrganizationStatusConfigSerializer(serializers.ModelSerializer[OrganizationStatusConfig]):
    status_id = serializers.UUIDField(source="status_item_id", read_only=True)

    class Meta:
        model = OrganizationStatusConfig
        fields = (
            "id",
            "organization_id",
            "status_id",
            "enabled",
            "name_override",
            "color_override",
            "order_override",
            "is_default_override",
            "updated_at",
        )
        read_only_fields = ("id", "organization_id", "status_id", "updated_at")


class OrganizationTaskTypeConfigSerializer(serializers.ModelSerializer[OrganizationTaskTypeConfig]):
    task_type_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = OrganizationTaskTypeConfig
        fields = (
            "id",
            "organization_id",
            "task_type_id",
            "enabled",
            "name_override",
            "description_override",
            "color_override",
            "department_code_override",
            "updated_at",
        )
        read_only_fields = ("id", "organization_id", "task_type_id", "updated_at")


class OrganizationAssetTypeConfigSerializer(serializers.ModelSerializer[OrganizationAssetTypeConfig]):
    asset_type_id = serializers.UUIDField(source="asset_type_id", read_only=True)

    class Meta:
        model = OrganizationAssetTypeConfig
        fields = (
            "id",
            "organization_id",
            "asset_type_id",
            "enabled",
            "name_override",
            "updated_at",
        )
        read_only_fields = ("id", "organization_id", "asset_type_id", "updated_at")


class OrganizationShotTypeConfigSerializer(serializers.ModelSerializer[OrganizationShotTypeConfig]):
    shot_type_id = serializers.UUIDField(source="shot_type_id", read_only=True)

    class Meta:
        model = OrganizationShotTypeConfig
        fields = (
            "id",
            "organization_id",
            "shot_type_id",
            "enabled",
            "name_override",
            "default_handle_frames_override",
            "updated_at",
        )
        read_only_fields = ("id", "organization_id", "shot_type_id", "updated_at")


class OrganizationReviewTypeConfigSerializer(serializers.ModelSerializer[OrganizationReviewTypeConfig]):
    review_type_id = serializers.UUIDField(source="review_type_id", read_only=True)

    class Meta:
        model = OrganizationReviewTypeConfig
        fields = (
            "id",
            "organization_id",
            "review_type_id",
            "enabled",
            "name_override",
            "allow_verdicts_override",
            "require_notes_override",
            "updated_at",
        )
        read_only_fields = ("id", "organization_id", "review_type_id", "updated_at")
