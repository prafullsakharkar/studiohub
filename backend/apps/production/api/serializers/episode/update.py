from typing import Any

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Episode


class EpisodeUpdateSerializer(BaseWriteSerializer[Any]):
    class Meta:
        model = Episode
        fields = (
            "name",
            "code",
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
        )
