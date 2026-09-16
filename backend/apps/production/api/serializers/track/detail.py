from typing import Any

from apps.core.api.serializers.base import BaseModelSerializer
from apps.production.api.serializers.track.list import TrackListSerializer
from apps.production.models import EditorialTrack


class TrackDetailSerializer(TrackListSerializer):
    """Full detail shape for a timeline track."""

    class Meta(TrackListSerializer.Meta):
        fields = TrackListSerializer.Meta.fields + (
            "codec_or_format",
            "channels_or_resolution",
            "frame_rate",
            "is_locked",
            "is_muted",
            "is_solo",
            "color_tag",
            "description",
            "created_at",
        )
