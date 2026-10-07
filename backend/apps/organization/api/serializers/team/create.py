
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
        )
        # URL hierarchy (`/organizations/{id}/teams/`) carries the org; the
        # viewset injects it via perform_create when the payload omits it.
        extra_kwargs = {"organization": {"required": False, "allow_null": True}}

    def create(self, validated_data):
        from apps.organization.services.team import TeamService
        from apps.organization.models import Department, Position, Person, Organization

        # Read-only model FK names ("department"/"lead"/"organization") are left
        # as UUID strings by the serializer; resolve them to instances here.
        for fk, model in (
            ("department", Department),
            ("lead", Person),
            ("organization", Organization),
        ):
            ref = validated_data.get(fk)
            if ref is not None and not isinstance(ref, model):
                validated_data[fk] = model.objects.get(id=str(ref))

        return TeamService.create(**validated_data)
