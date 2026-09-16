from apps.production.api.serializers.show.list import ShowListSerializer


class ShowDetailSerializer(ShowListSerializer):
    """Full detail shape for a show."""

    class Meta(ShowListSerializer.Meta):
        pass
