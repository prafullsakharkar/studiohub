"""
Platform catalog serializers (frontend contract shapes).
"""

from __future__ import annotations

from rest_framework import serializers

from apps.masterdata.models import (
    MasterAssetType,
    MasterFileType,
    MasterReviewType,
    MasterShotType,
    MasterStatus,
    MasterTaskType,
    Software,
    SoftwareVersion,
)


class SoftwareSerializer(serializers.ModelSerializer[Software]):
    version_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Software
        fields = (
            "id",
            "name",
            "code",
            "publisher",
            "category",
            "description",
            "website",
            "status",
            "scope",
            "organization_id",
            "is_system",
            "metadata",
            "version_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "version_count", "created_at", "updated_at")


class SoftwareVersionSerializer(serializers.ModelSerializer[SoftwareVersion]):
    class Meta:
        model = SoftwareVersion
        fields = (
            "id",
            "software_id",
            "version",
            "version_code",
            "release_date",
            "end_of_support",
            "status",
            "scope",
            "organization_id",
            "metadata",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class MasterStatusSerializer(serializers.ModelSerializer[MasterStatus]):
    class Meta:
        model = MasterStatus
        fields = (
            "id",
            "entity_type",
            "name",
            "code",
            "category",
            "color",
            "order",
            "is_default",
            "is_final",
            "description",
            "scope",
            "organization_id",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class MasterTaskTypeSerializer(serializers.ModelSerializer[MasterTaskType]):
    class Meta:
        model = MasterTaskType
        fields = (
            "id",
            "name",
            "code",
            "category",
            "department_code",
            "department_name",
            "description",
            "color",
            "icon",
            "scope",
            "organization_id",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class MasterAssetTypeSerializer(serializers.ModelSerializer[MasterAssetType]):
    class Meta:
        model = MasterAssetType
        fields = (
            "id",
            "name",
            "code",
            "description",
            "icon",
            "color",
            "scope",
            "organization_id",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class MasterShotTypeSerializer(serializers.ModelSerializer[MasterShotType]):
    class Meta:
        model = MasterShotType
        fields = (
            "id",
            "name",
            "code",
            "description",
            "default_handle_frames",
            "scope",
            "organization_id",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class MasterReviewTypeSerializer(serializers.ModelSerializer[MasterReviewType]):
    class Meta:
        model = MasterReviewType
        fields = (
            "id",
            "name",
            "code",
            "description",
            "allow_verdicts",
            "require_notes",
            "scope",
            "organization_id",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class MasterFileTypeSerializer(serializers.ModelSerializer[MasterFileType]):
    class Meta:
        model = MasterFileType
        fields = (
            "id",
            "name",
            "extension",
            "mime_type",
            "category",
            "description",
            "dcc_affinity",
            "scope",
            "organization_id",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
