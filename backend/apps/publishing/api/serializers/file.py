"""
Serializers for the published file registry.

Registration bodies are strict: an unknown key is a 400, so a pipeline tool never believes a
field was stored when it was not (docs/publishing/CONTRACTS.md section 3).
"""

from __future__ import annotations

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.production.permissions.checks import has_permission_code
from apps.publishing.constants.permissions import PublishPermissions
from apps.publishing.models import PublishedFile
from apps.publishing.models.dependency import MAX_UPSTREAMS


class PublishedFileSerializer(serializers.ModelSerializer[PublishedFile]):
    storage_root = serializers.CharField(source="storage_root.code", read_only=True)
    file_type = serializers.SerializerMethodField()
    revoke_reason = serializers.SerializerMethodField()
    created_by_id = serializers.UUIDField(read_only=True)
    upstream_count = serializers.SerializerMethodField()
    downstream_count = serializers.SerializerMethodField()

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
            "upstream_count",
            "downstream_count",
        )
        read_only_fields = fields

    def get_file_type(self, obj: PublishedFile) -> str:
        return obj.file_type.code if obj.file_type else ""

    def get_upstream_count(self, obj: PublishedFile) -> int:
        """How many files this one was built from (C-RP-16); annotated by the selector on reads."""
        total = getattr(obj, "upstream_total", None)
        return total if total is not None else obj.upstream_links.count()  # pyright: ignore[reportAttributeAccessIssue]

    def get_downstream_count(self, obj: PublishedFile) -> int:
        total = getattr(obj, "downstream_total", None)
        return total if total is not None else obj.downstream_links.count()  # pyright: ignore[reportAttributeAccessIssue]

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
    # The files this one was built from, written with it and never changed (C-RP-16, Q-RP-19).
    upstream_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, max_length=MAX_UPSTREAMS
    )

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


class DependencyRowSerializer(serializers.ModelSerializer[PublishedFile]):
    """One upstream or downstream file in ``GET files/{id}/dependencies/`` (C-RP-16)."""

    storage_root = serializers.CharField(source="storage_root.code", read_only=True)
    file_type = serializers.SerializerMethodField()
    version_code = serializers.CharField(source="version.code", read_only=True)

    class Meta:
        model = PublishedFile
        fields = (
            "id",
            "storage_root",
            "relative_path",
            "role",
            "file_type",
            "status",
            "version_id",
            "version_code",
        )
        read_only_fields = fields

    def get_file_type(self, obj: PublishedFile) -> str:
        return obj.file_type.code if obj.file_type else ""


class DependenciesSerializer(serializers.Serializer[Any]):
    upstream = DependencyRowSerializer(many=True)
    downstream = DependencyRowSerializer(many=True)


class LoaderVersionSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()
    version_index = serializers.IntegerField()
    status = serializers.CharField()
    is_hero = serializers.BooleanField()


class LoaderTaskSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()


class LoaderRowSerializer(PublishedFileSerializer):
    """A file of ``GET files/loader/``, with its version and task (C-RP-17)."""

    version = LoaderVersionSerializer(read_only=True)
    task = serializers.SerializerMethodField()

    class Meta(PublishedFileSerializer.Meta):
        fields = (*PublishedFileSerializer.Meta.fields, "version", "task")
        read_only_fields = fields

    @extend_schema_field(LoaderTaskSerializer(allow_null=True))
    def get_task(self, obj: PublishedFile) -> dict[str, str] | None:
        task = obj.version.task
        return {"id": str(task.pk), "code": task.code} if task else None


class LoaderQuerySerializer(serializers.Serializer[Any]):
    shot = serializers.UUIDField(required=False)
    asset = serializers.UUIDField(required=False)
    task = serializers.UUIDField(required=False)
    file_type = serializers.CharField(required=False, allow_blank=True, max_length=64)
    role = serializers.ChoiceField(choices=PublishedFile.Role.choices, required=False)
    which = serializers.ChoiceField(choices=("latest", "approved", "hero"), required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        given = [name for name in ("shot", "asset", "task") if attrs.get(name)]
        if len(given) != 1:
            raise serializers.ValidationError(
                {"detail": ["Give exactly one of shot, asset or task."]}
            )
        return attrs


class ResolvePathQuerySerializer(serializers.Serializer[Any]):
    version_id = serializers.UUIDField()
    file_type = serializers.CharField(max_length=64)
    role = serializers.ChoiceField(choices=PublishedFile.Role.choices, required=False)


class ResolvedPathSerializer(serializers.Serializer[Any]):
    template_id = serializers.UUIDField()
    storage_root = serializers.CharField()
    pattern = serializers.CharField()
    relative_path = serializers.CharField()
    enforce = serializers.BooleanField()
