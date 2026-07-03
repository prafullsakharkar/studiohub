from .base import TeamBaseSerializer


class TeamCreateSerializer(TeamBaseSerializer):
    """
    Input serializer for creating Team.
    """

    class Meta(TeamBaseSerializer.Meta):
        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
            "status",
        )

    def create(self, validated_data):
        from apps.organization.services.team import TeamService

        return TeamService.create(**validated_data)
