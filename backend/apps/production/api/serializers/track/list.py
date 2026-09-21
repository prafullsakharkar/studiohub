from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseModelSerializer
from apps.production.models import EditorialTrack


class TrackListSerializer(BaseModelSerializer[Any]):
    """Flat list shape matching the frontend EditorialTrack contract."""

    project_id = serializers.UUIDField(source="project.id", read_only=True)
    project_code = serializers.CharField(source="project.code", read_only=True)

    class Meta:
        model = EditorialTrack
        fields = (
            "id",
            "uuid",
            "project_id",
            "project_code",
            "cut_id",
            "cut_name",
            "track_number",
            "track_type",
            "name",
            "status",
            "clip_count",
            "start_tc",
            "end_tc",
            "updated_at",
        )
