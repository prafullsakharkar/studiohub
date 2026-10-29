from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import FrameRangeMixin, NormalizedCodeMixin
from apps.production.models import Episode


class EpisodeUpdateSerializer(NormalizedCodeMixin, FrameRangeMixin, BaseWriteSerializer[Any]):
    # Files the record under a show (TPN review TM-002). The viewset resolves it inside the project.
    show_id = serializers.UUIDField(
        source="show", write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = Episode
        fields = (
            "show_id",
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
