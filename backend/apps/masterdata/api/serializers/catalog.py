"""
Platform catalog serializers (frontend contract shapes).
"""

from __future__ import annotations

from typing import Any

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
            "metadata",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


_LOOKUP_READ_ONLY = ("id", "status", "is_system", "created_at", "updated_at")
# Only the global scope is supported (docs/masterdata/DECISIONS.md D12).
_GLOBAL_ONLY = {"scope": {"choices": [("GLOBAL", "Global")], "required": False}}


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
            "status",
            "is_system",
            "created_at",
            "updated_at",
        )
        read_only_fields = _LOOKUP_READ_ONLY
        # Uniqueness is the service's job: DRF would turn the partial
        # constraints into unconditional validators (it ignores ``condition``).
        validators = []
        # DRF turns the single-field ``one default per entity type`` partial
        # constraint into a UniqueValidator on entity_type; the service owns it.
        extra_kwargs = {**_GLOBAL_ONLY, "entity_type": {"validators": []}}


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
            "status",
            "is_system",
            "sort_order",
            "created_at",
            "updated_at",
        )
        read_only_fields = _LOOKUP_READ_ONLY
        # Uniqueness is the service's job: DRF would turn the partial
        # constraints into unconditional validators (it ignores ``condition``).
        validators = []
        extra_kwargs = _GLOBAL_ONLY


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
            "status",
            "is_system",
            "sort_order",
            "created_at",
            "updated_at",
        )
        read_only_fields = _LOOKUP_READ_ONLY
        # Uniqueness is the service's job: DRF would turn the partial
        # constraints into unconditional validators (it ignores ``condition``).
        validators = []
        extra_kwargs = _GLOBAL_ONLY


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
            "status",
            "is_system",
            "sort_order",
            "created_at",
            "updated_at",
        )
        read_only_fields = _LOOKUP_READ_ONLY
        # Uniqueness is the service's job: DRF would turn the partial
        # constraints into unconditional validators (it ignores ``condition``).
        validators = []
        extra_kwargs = _GLOBAL_ONLY


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
            "status",
            "is_system",
            "sort_order",
            "created_at",
            "updated_at",
        )
        read_only_fields = _LOOKUP_READ_ONLY
        # Uniqueness is the service's job: DRF would turn the partial
        # constraints into unconditional validators (it ignores ``condition``).
        validators = []
        extra_kwargs = _GLOBAL_ONLY


class MasterFileTypeSerializer(serializers.ModelSerializer[MasterFileType]):
    class Meta:
        model = MasterFileType
        fields = (
            "id",
            "name",
            # Optional on create: derived from ``extension`` when omitted.
            "code",
            "extension",
            "mime_type",
            "category",
            "description",
            "dcc_affinity",
            "scope",
            "status",
            "is_system",
            "sort_order",
            "created_at",
            "updated_at",
        )
        read_only_fields = _LOOKUP_READ_ONLY
        # Uniqueness is the service's job: DRF would turn the partial
        # constraints into unconditional validators (it ignores ``condition``).
        validators = []
        extra_kwargs = {**_GLOBAL_ONLY, "code": {"required": False}}


class ReorderSerializer(serializers.Serializer[dict[str, Any]]):
    ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False, max_length=1000)
