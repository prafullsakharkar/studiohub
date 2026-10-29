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

_LOOKUP_READ_ONLY = ("id", "status", "is_system", "created_at", "updated_at")


def _scope_field() -> serializers.ChoiceField:
    """``scope`` is a constant (docs/masterdata/DECISIONS.md D12): reported as GLOBAL,
    accepted on input only as GLOBAL and ignored; anything else is a 400."""
    return serializers.ChoiceField(choices=[("GLOBAL", "Global")], required=False)


class SoftwareSerializer(serializers.ModelSerializer[Software]):
    scope = _scope_field()

    # Annotated by the selector (one query); see SoftwareViewSet.present().
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
            "sort_order",
            "metadata",
            "version_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (*_LOOKUP_READ_ONLY, "version_count")
        validators = []


class SoftwareVersionSerializer(serializers.ModelSerializer[SoftwareVersion]):
    scope = _scope_field()

    is_deprecated = serializers.BooleanField(read_only=True)

    class Meta:
        model = SoftwareVersion
        fields = (
            "id",
            "software_id",
            # Optional on create: derived from the software and ``version``.
            "code",
            "name",
            "version",
            "version_code",
            "release_date",
            "end_of_support",
            "status",
            "scope",
            "is_system",
            "sort_order",
            "is_deprecated",
            "metadata",
            "created_at",
            "updated_at",
        )
        read_only_fields = (*_LOOKUP_READ_ONLY, "software_id", "is_deprecated")
        validators = []
        extra_kwargs = {"code": {"required": False}, "name": {"required": False}}


class MasterStatusSerializer(serializers.ModelSerializer[MasterStatus]):
    scope = _scope_field()

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
        extra_kwargs = {"entity_type": {"validators": []}}


class MasterTaskTypeSerializer(serializers.ModelSerializer[MasterTaskType]):
    scope = _scope_field()

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


class MasterAssetTypeSerializer(serializers.ModelSerializer[MasterAssetType]):
    scope = _scope_field()

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


class MasterShotTypeSerializer(serializers.ModelSerializer[MasterShotType]):
    scope = _scope_field()

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


class MasterReviewTypeSerializer(serializers.ModelSerializer[MasterReviewType]):
    scope = _scope_field()

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


class MasterFileTypeSerializer(serializers.ModelSerializer[MasterFileType]):
    scope = _scope_field()

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
        extra_kwargs = {"code": {"required": False}}


class ReorderSerializer(serializers.Serializer[dict[str, Any]]):
    ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False, max_length=1000)
