from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import (
    LenientUniqueTogetherValidator,
    ProjectReferenceMixin,
)
from apps.production.models import Show


class ShowCreateSerializer(ProjectReferenceMixin, BaseWriteSerializer[Any]):
    """Create serializer accepting the frontend Show contract."""

    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)
    # Frontend sends `type`; the model field is `show_type`.
    type = serializers.ChoiceField(
        choices=[
            "Feature Film",
            "Episodic Series",
            "Commercial",
            "Trailer",
            "Short",
        ],
        source="show_type",
        required=False,
    )

    class Meta:
        model = Show
        fields = (
            "id",
            "uuid",
            "project",
            "project_id",
            "project_code",
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
        )
        validators = [
            LenientUniqueTogetherValidator(
                queryset=Show.objects.all(),
                fields=["project", "code"],
            )
        ]
