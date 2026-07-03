from .base import TeamBaseSerializer


class TeamNestedSerializer(TeamBaseSerializer):
    """
    Lightweight nested representation.
    """

    class Meta(TeamBaseSerializer.Meta):
        fields = (
            "uuid",
            "code",
            "name",
            "lead",
        )
