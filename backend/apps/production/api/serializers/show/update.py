from apps.production.api.serializers.show.create import ShowCreateSerializer


class ShowUpdateSerializer(ShowCreateSerializer):
    """Update serializer for shows."""

    class Meta(ShowCreateSerializer.Meta):
        pass
