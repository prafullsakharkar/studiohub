from .base import TeamBaseSerializer


class TeamDetailSerializer(TeamBaseSerializer):
    """
    Full representation of Team.
    """

    class Meta(TeamBaseSerializer.Meta):
        pass
