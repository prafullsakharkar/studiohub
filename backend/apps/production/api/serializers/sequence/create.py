from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Sequence


class SequenceCreateSerializer(BaseWriteSerializer):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)

    class Meta:
        model = Sequence
        fields = (
            "id",
            "uuid",
            "project",
            "code",
            "name",
            "status",
            "description",
            "frame_in",
            "frame_out",
            "department",
            "tags",
            "metadata",
        )
        read_only_fields = ("id", "uuid")
