from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Project


class ProjectUpdateSerializer(BaseWriteSerializer):
    class Meta:
        model = Project
        fields = (
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
