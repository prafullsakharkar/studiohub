from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Shot


class ShotUpdateSerializer(BaseWriteSerializer[Any]):
    # Same reference aliases as create; the viewset resolves + validates the
    # episodic chain against the shot's (unchangeable) project before saving.
    episode_id = serializers.CharField(
        source="episode", write_only=True, required=False, allow_blank=True
    )
    sequence_id = serializers.CharField(
        source="sequence_ref", write_only=True, required=False, allow_blank=True
    )

    class Meta:
        model = Shot
        fields = (
            "episode_id",
            "sequence_id",
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
