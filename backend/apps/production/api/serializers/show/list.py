from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseModelSerializer
from apps.production.models import Show


class ShowListSerializer(BaseModelSerializer[Any]):
    """Flat list shape matching the frontend Show contract."""

    project_id = serializers.UUIDField(source="project.id", read_only=True)
    project_code = serializers.CharField(source="project.code", read_only=True)
    type = serializers.CharField(source="show_type", read_only=True)

    class Meta:
        model = Show
        fields = (
            "id",
            "uuid",
            "project_id",
            "project_code",
            "organization_id",
            "name",
            "code",
            "type",
            "status",
            "season",
            "description",
            "start_date",
            "delivery_date",
            "thumbnail_url",
            "is_primary",
            "created_at",
            "updated_at",
        )
