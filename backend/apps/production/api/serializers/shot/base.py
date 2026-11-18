from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.api.serializers.shot.current_version import ShotCurrentVersionMixin
from apps.production.models import Shot


class ShotGradeSerializer(serializers.Serializer[Any]):
    """A shot's grade, its ASC CDL (RP-20, C-RP-52): three numbers per channel, red, green, blue."""

    slope = serializers.ListField(child=serializers.FloatField(), min_length=3, max_length=3)
    offset = serializers.ListField(child=serializers.FloatField(), min_length=3, max_length=3)
    power = serializers.ListField(child=serializers.FloatField(), min_length=3, max_length=3)
    saturation = serializers.FloatField()


class ShotSerializer(ShotCurrentVersionMixin, BaseReadSerializer[Any]):  # pyright: ignore[reportUnsafeMultipleInheritance]
    project_id = serializers.UUIDField(read_only=True)
    show_id = serializers.UUIDField(read_only=True, allow_null=True)
    project_code = serializers.SerializerMethodField()
    episode_id = serializers.UUIDField(read_only=True, allow_null=True)
    sequence_id = serializers.UUIDField(read_only=True, allow_null=True)
    sequence_code = serializers.CharField(read_only=True)
    frame_count = serializers.IntegerField(read_only=True)
    assigned_artist_id = serializers.UUIDField(read_only=True, allow_null=True)
    assigned_artist_name = serializers.SerializerMethodField()
    pipeline = serializers.JSONField(read_only=True)
    # RP-20 (C-RP-52): the shot's ASC CDL, or null
    grade = ShotGradeSerializer(read_only=True, allow_null=True)

    class Meta:
        model = Shot
        fields = (
            "id",
            "uuid",
            "project_id",
            "show_id",
            "project_code",
            "episode_id",
            "sequence_id",
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
            "current_version_id",
            "assigned_artist_id",
            "assigned_artist_name",
            "supervisor_approved",
            "client_approved",
            "pipeline",
            "grade",
            "grade_source",
            "grade_updated_at",
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
