
from apps.production.api.serializers.track.create import TrackCreateSerializer


class TrackUpdateSerializer(TrackCreateSerializer):
    """Update serializer for timeline tracks."""

    class Meta(TrackCreateSerializer.Meta):
        pass
