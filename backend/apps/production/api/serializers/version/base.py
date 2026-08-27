from rest_framework import serializers
from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.models import Version

class VersionSerializer(BaseReadSerializer):
    project_id = serializers.UUIDField(read_only=True, allow_null=True)
    project_code = serializers.SerializerMethodField()
    artist_id = serializers.UUIDField(read_only=True, allow_null=True)
    artist_name = serializers.SerializerMethodField()
    shot_id = serializers.UUIDField(read_only=True, allow_null=True)
    asset_id = serializers.UUIDField(read_only=True, allow_null=True)
    task_id = serializers.UUIDField(read_only=True, allow_null=True)

    class Meta:
        model = Version
        fields = (
            "id", "uuid", "code", "version_number", "version_index",
            "project_id", "project_code",
            "entity_type", "entity_id", "entity_code", "entity_name",
            "shot_id", "asset_id", "task_id",
            "department", "artist_id", "artist_name",
            "status", "is_published", "is_hero", "is_archived",
            "thumbnail_url", "video_url", "source_file_url",
            "frame_range", "start_frame", "end_frame", "resolution", "fps", "file_size_mb", "color_space", "file_path",
            "notes", "changelog", "tags", "publishing_info", "media_items", "attachments", "reviews", "playlists", "notes_list", "activity",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "uuid", "created_at", "updated_at")

    def get_project_code(self, obj):
        return obj.project.code if obj.project else ""
    def get_artist_name(self, obj):
        if obj.artist:
            profile = getattr(obj.artist, "profile", None)
            if profile and getattr(profile, "display_name", None):
                return profile.display_name
            return obj.artist.email
        return ""
