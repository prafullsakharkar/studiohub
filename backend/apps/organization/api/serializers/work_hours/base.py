from rest_framework import serializers

from apps.organization.models.team import Team


class TeamBaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "description",
            "organization",
            "department",
            "lead",
            "color",
            "capacity",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )
