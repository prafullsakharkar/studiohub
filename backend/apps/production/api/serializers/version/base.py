from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.api.serializers.review_media import ReviewMediaSerializer
from apps.production.models import Version
from apps.production.selectors.review_media import ReviewMediaSelector


class VersionSerializer(BaseReadSerializer[Any]):
    is_archived = serializers.BooleanField(source="is_deleted", read_only=True)
    published_by_id = serializers.UUIDField(read_only=True, allow_null=True)
    project_id = serializers.UUIDField(read_only=True, allow_null=True)
    project_code = serializers.SerializerMethodField()
    artist_id = serializers.UUIDField(read_only=True, allow_null=True)
    artist_name = serializers.SerializerMethodField()
    shot_id = serializers.UUIDField(read_only=True, allow_null=True)
    asset_id = serializers.UUIDField(read_only=True, allow_null=True)
    task_id = serializers.UUIDField(read_only=True, allow_null=True)
    # The movie the server made (C-RP-21): the ready row, and the newest upload not ready yet.
    review_media = serializers.SerializerMethodField()
    review_media_job = serializers.SerializerMethodField()

    class Meta:
        model = Version
        fields = (
            "id", "uuid", "code", "version_number", "version_index",
            "project_id", "project_code",
            "entity_type", "entity_id", "entity_code", "entity_name",
            "shot_id", "asset_id", "task_id",
            "department", "artist_id", "artist_name",
            "status", "is_published", "published_at", "published_by_id", "is_hero", "is_archived",
            "thumbnail_url", "video_url", "source_file_url",
            "frame_range", "start_frame", "end_frame", "resolution", "fps", "file_size_mb", "color_space", "file_path",
            # No lists of what holds the version (C-RP-01; the JSON copies were dropped by RP-1): the reviews
            # and playlists of a version are read with ``?version_id=`` on their own lists (C-RP-03, C-RP-04).
            "notes", "changelog", "tags", "publishing_info",
            "review_media", "review_media_job",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "uuid", "created_at", "updated_at")

    @extend_schema_field(ReviewMediaSerializer(allow_null=True))
    def get_review_media(self, obj):
        row = ReviewMediaSelector.current(obj)
        return ReviewMediaSerializer(row, context=self.context).data if row is not None else None

    @extend_schema_field(ReviewMediaSerializer(allow_null=True))
    def get_review_media_job(self, obj):
        row = ReviewMediaSelector.job(obj)
        return ReviewMediaSerializer(row, context=self.context).data if row is not None else None

    def get_project_code(self, obj):
        return obj.project.code if obj.project else ""
    def get_artist_name(self, obj):
        if obj.artist:
            profile = getattr(obj.artist, "profile", None)
            if profile and getattr(profile, "display_name", None):
                return profile.display_name
            return obj.artist.email
        return ""
