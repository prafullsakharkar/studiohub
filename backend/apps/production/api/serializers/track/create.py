from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import ProjectReferenceMixin
from apps.production.models import EditorialTrack


class TrackCreateSerializer(ProjectReferenceMixin, BaseWriteSerializer[Any]):
    """Create serializer accepting the frontend EditorialTrack contract."""

    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)

    class Meta:
        model = EditorialTrack
        fields = (
            "id",
            "uuid",
            "project",
            "project_id",
            "project_code",
            "cut_id",
            "cut_name",
            "track_number",
            "track_type",
            "name",
            "codec_or_format",
            "channels_or_resolution",
            "frame_rate",
            "is_locked",
            "is_muted",
            "is_solo",
            "color_tag",
            "clip_count",
            "description",
            "status",
            "start_tc",
            "end_tc",
        )
