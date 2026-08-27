from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Shot


class ShotCreateSerializer(BaseWriteSerializer):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)

    class Meta:
        model = Shot
        fields = (
            "id",
            "uuid",
            "project",
            "sequence_code",
            "code",
            "name",
            "description",
            "status",
            "frame_in",
            "frame_out",
            "handle_frames",
            "thumbnail_url",
            "video_url",
            "current_version",
            "assigned_artist",
            "supervisor_approved",
            "client_approved",
            "pipeline",
        )
        read_only_fields = ("id", "uuid")
