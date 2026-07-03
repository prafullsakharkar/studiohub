from .base import TeamBaseSerializer


class TeamUpdateSerializer(TeamBaseSerializer):
    """
    Input serializer for updating Team.
    """

    class Meta(TeamBaseSerializer.Meta):
        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )

    def update(self, instance, validated_data):
        from apps.organization.services.team import TeamService

        return TeamService.update(
            instance=instance,
            **validated_data,
        )
