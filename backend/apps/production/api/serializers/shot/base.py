from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.models import Shot


class ShotSerializer(BaseReadSerializer):
    project_id = serializers.UUIDField(read_only=True)
    project_code = serializers.SerializerMethodField()
    sequence_code = serializers.CharField(read_only=True)
    frame_count = serializers.IntegerField(read_only=True)
    assigned_artist_id = serializers.UUIDField(read_only=True, allow_null=True)
    assigned_artist_name = serializers.SerializerMethodField()
    pipeline = serializers.JSONField(read_only=True)

    class Meta:
        model = Shot
        fields = (
            "id",
            "uuid",
            "project_id",
            "project_code",
            "sequence_code",
            "code",
            "name",
            "description",
            "status",
            "frame_in",
            "frame_out",
            "frame_count",
            "handle_frames",
            "thumbnail_url",
            "video_url",
            "current_version",
            "assigned_artist_id",
            "assigned_artist_name",
            "supervisor_approved",
            "client_approved",
            "pipeline",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "uuid", "created_at", "updated_at", "frame_count", "project_code")

    def get_project_code(self, obj):
        return obj.project.code if obj.project else ""

    def get_assigned_artist_name(self, obj):
        if obj.assigned_artist:
            profile = getattr(obj.assigned_artist, "profile", None)
            if profile and getattr(profile, "display_name", None):
                return profile.display_name
            return obj.assigned_artist.email
        return ""
