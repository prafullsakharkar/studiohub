"""
Serializers for the published file registry.

Registration bodies are strict: an unknown key is a 400, so a pipeline tool never believes a
field was stored when it was not (docs/publishing/CONTRACTS.md section 3).
"""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.production.permissions.checks import has_permission_code
from apps.publishing.constants.permissions import PublishPermissions
from apps.publishing.models import PublishedFile


class PublishedFileSerializer(serializers.ModelSerializer[PublishedFile]):
    storage_root = serializers.CharField(source="storage_root.code", read_only=True)
    file_type = serializers.SerializerMethodField()
    revoke_reason = serializers.SerializerMethodField()
    created_by_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = PublishedFile
        fields = (
            "id",
            "version_id",
            "project_id",
            "storage_root",
            "relative_path",
            "role",
            "file_type",
            "size_bytes",
            "sha256",
            "frame_start",
            "frame_end",
            "checksum_state",
            "checksum_checked_at",
            "status",
            "status_changed_at",
            "revoke_reason",
            "export_job_id",
            "created_at",
            "created_by_id",
        )
        read_only_fields = fields

    def get_file_type(self, obj: PublishedFile) -> str:
        return obj.file_type.code if obj.file_type else ""

    def get_revoke_reason(self, obj: PublishedFile) -> str:
        """Shown to holders of ``publishing.revoke`` and to whoever registered the file."""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if request is None or user is None or not getattr(user, "is_authenticated", False):
            return ""
        if obj.created_by_id == user.pk or has_permission_code(  # pyright: ignore[reportAttributeAccessIssue]
            request, PublishPermissions.REVOKE
        ):
            return obj.revoke_reason
        return ""


class RegisterFileSerializer(serializers.Serializer[Any]):
    version_id = serializers.UUIDField()
    storage_root = serializers.CharField(max_length=64)
    relative_path = serializers.CharField(max_length=1024, trim_whitespace=False)
    role = serializers.CharField(required=False, max_length=20)
    file_type = serializers.CharField(required=False, allow_blank=True, max_length=64)
    size_bytes = serializers.IntegerField(min_value=0)
    sha256 = serializers.CharField(max_length=64)
    frame_start = serializers.IntegerField(required=False, allow_null=True)
    frame_end = serializers.IntegerField(required=False, allow_null=True)
    export_job_id = serializers.UUIDField(required=False, allow_null=True)

    def to_internal_value(self, data: Any) -> dict[str, Any]:
        unknown = sorted(set(getattr(data, "keys", lambda: [])()) - set(self.fields))
        if unknown:
            raise serializers.ValidationError({name: ["Unknown field."] for name in unknown})
        return super().to_internal_value(data)


class BulkRegisterSerializer(serializers.Serializer[Any]):
    items = serializers.ListField(child=serializers.DictField(), allow_empty=False, max_length=100)


class DeprecateSerializer(serializers.Serializer[Any]):
    note = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    # Only needed to leave Revoked (needs publishing.status.override).
    override_reason = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class RestoreSerializer(serializers.Serializer[Any]):
    # Only needed to leave Revoked (needs publishing.status.override).
    override_reason = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class RevokeSerializer(serializers.Serializer[Any]):
    reason = serializers.CharField(max_length=1000)
