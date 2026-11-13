"""Serializers for path templates (review-pipeline RP-4, C-RP-18); writes go through the service."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.publishing.models import PublishedFile, PublishPathTemplate


class PathTemplateSerializer(serializers.ModelSerializer[PublishPathTemplate]):
    project_id = serializers.UUIDField(read_only=True, allow_null=True)
    file_type = serializers.CharField(source="file_type.code", read_only=True)
    storage_root = serializers.CharField(source="storage_root.code", read_only=True)

    class Meta:
        model = PublishPathTemplate
        fields = (
            "id",
            "project_id",
            "file_type",
            "role",
            "storage_root",
            "pattern",
            "enforce",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class _Strict(serializers.Serializer[Any]):
    """An unknown key is a 400, so a caller never believes a field was stored when it was not."""

    def to_internal_value(self, data: Any) -> dict[str, Any]:
        unknown = sorted(set(getattr(data, "keys", lambda: [])()) - set(self.fields))
        if unknown:
            raise serializers.ValidationError({name: ["Unknown field."] for name in unknown})
        return super().to_internal_value(data)


class PathTemplateCreateSerializer(_Strict):
    project = serializers.UUIDField(required=False, allow_null=True)
    file_type = serializers.CharField(max_length=64)
    role = serializers.ChoiceField(choices=PublishedFile.Role.choices, required=False)
    storage_root = serializers.CharField(max_length=64)
    pattern = serializers.CharField(max_length=1024, trim_whitespace=False)
    enforce = serializers.BooleanField(required=False)
    is_active = serializers.BooleanField(required=False)


class PathTemplateUpdateSerializer(_Strict):
    # The key is fixed; sending it unchanged is allowed, a different value is refused by the service.
    project = serializers.UUIDField(required=False, allow_null=True)
    file_type = serializers.CharField(required=False, max_length=64)
    role = serializers.ChoiceField(choices=PublishedFile.Role.choices, required=False)
    storage_root = serializers.CharField(required=False, max_length=64)
    pattern = serializers.CharField(required=False, max_length=1024, trim_whitespace=False)
    enforce = serializers.BooleanField(required=False)
    is_active = serializers.BooleanField(required=False)
