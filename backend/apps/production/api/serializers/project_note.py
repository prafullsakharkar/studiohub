from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer, BaseWriteSerializer
from apps.production.models import ProjectNote


class ProjectNoteSerializer(BaseReadSerializer[Any]):
    """Frontend ProjectNote shape."""

    project_id = serializers.UUIDField(read_only=True)
    project_code = serializers.SerializerMethodField()
    author_id = serializers.SerializerMethodField()

    class Meta:
        model = ProjectNote
        fields = (
            "id",
            "project_id",
            "project_code",
            "entity_type",
            "entity_id",
            "entity_code",
            "entity_name",
            "author_id",
            "author_name",
            "author_avatar",
            "author_role",
            "subject",
            "body",
            "category",
            "priority",
            "tags",
            "status",
            "addressed_by",
            "addressed_at",
            "timecode_ref",
            "frame_number",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
        )

    def get_project_code(self, obj):
        return obj.project.code if obj.project else ""

    def get_author_id(self, obj):
        return str(obj.author_id) if obj.author_id else ""


class ProjectNoteCreateSerializer(BaseWriteSerializer[Any]):
    """Accept frontend Partial<ProjectNote> (ownership derived server-side)."""

    class Meta:
        model = ProjectNote
        fields = (
            "entity_type",
            "entity_id",
            "entity_code",
            "entity_name",
            "author_name",
            "author_avatar",
            "author_role",
            "subject",
            "body",
            "category",
            "priority",
            "tags",
            "status",
            "timecode_ref",
            "frame_number",
        )
