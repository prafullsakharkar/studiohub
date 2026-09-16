from typing import Any

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.track.create import TrackCreateSerializer
from apps.production.models import EditorialTrack


class TrackUpdateSerializer(TrackCreateSerializer):
    """Update serializer for timeline tracks."""

    class Meta(TrackCreateSerializer.Meta):
        pass
