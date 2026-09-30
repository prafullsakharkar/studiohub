from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.models import Episode


class EpisodeSerializer(BaseReadSerializer[Any]):
    project_id = serializers.UUIDField(read_only=True)
    project_code = serializers.SerializerMethodField()
    project_name = serializers.SerializerMethodField()
    is_deleted = serializers.BooleanField(read_only=True)
    deleted_at = serializers.DateTimeField(read_only=True, allow_null=True)

    class Meta:
        model = Episode
        fields = (
            "id",
            "uuid",
            "project_id",
            "project_code",
            "project_name",
            "code",
            "name",
            "season_number",
            "episode_number",
            "status",
            "description",
            "frame_in",
            "frame_out",
            "duration_frames",
            "air_date",
            "delivery_date",
            "metadata",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
        )

    def get_project_code(self, obj):
        return obj.project.code if obj.project else ""

    def get_project_name(self, obj):
        return obj.project.name if obj.project else ""
