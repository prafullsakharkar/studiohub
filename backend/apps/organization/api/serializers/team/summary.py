from .base import TeamBaseSerializer


class TeamSummarySerializer(
    TeamBaseSerializer,
):

    class Meta(TeamBaseSerializer.Meta):

        fields = (
            "id",
            "uuid",
            "name",
            "code",
        )
