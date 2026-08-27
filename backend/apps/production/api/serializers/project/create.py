from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Project


class ProjectCreateSerializer(BaseWriteSerializer):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)

    class Meta:
        model = Project
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "description",
            "type",
            "status",
            "fps",
            "resolution",
            "aspect_ratio",
            "color_space",
            "start_date",
            "delivery_date",
            "thumbnail_url",
            "budget_usd",
            "supervisor",
            "coordinator",
            "client_id",
            "client_name",
            "client_contact_id",
            "client_contact_name",
            "vendor_ids",
            "vendor_names",
            "vendor_team_ids",
        )
        read_only_fields = ("id", "uuid")
