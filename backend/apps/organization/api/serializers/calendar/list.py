from .base import TeamBaseSerializer


class TeamListSerializer(TeamBaseSerializer):
    """
    Lightweight serializer for list views.
    """

    class Meta(TeamBaseSerializer.Meta):
        fields = (
            "uuid",
            "code",
            "name",
            "department",
            "lead",
            "status",
        )
