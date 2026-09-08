from typing import Any

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Shot


class ShotUpdateSerializer(BaseWriteSerializer[Any]):
    class Meta:
        model = Shot
        fields = (
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
