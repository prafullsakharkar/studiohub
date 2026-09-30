from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import (
    LenientUniqueTogetherValidator,
    ProjectReferenceMixin,
)
from apps.production.models import Shot


class ShotCreateSerializer(ProjectReferenceMixin, BaseWriteSerializer[Any]):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)
    # Frontend contract: ``episode_id``/``sequence_id`` arrive as raw
    # reference strings (UUID, code, or mock id). They land in
    # ``validated_data`` as strings (``episode`` mirrors the
    # ProjectReferenceMixin pattern); the viewset resolves them org- and
    # project-scoped and enforces the episodic chain before saving.
    episode_id = serializers.CharField(
        source="episode", write_only=True, required=False, allow_blank=True
    )
    sequence_id = serializers.CharField(
        source="sequence_ref", write_only=True, required=False, allow_blank=True
    )

    class Meta:
        model = Shot
        fields = (
            "id",
            "uuid",
            "project",
            "project_id",
            "project_code",
            "episode_id",
            "sequence_id",
            "sequence_code",
            "code",
            "name",
            "description",
            "status",
            "frame_in",
            "frame_out",
            "handle_frames",
            "thumbnail_url",
            "video_url",
            "current_version",
            "assigned_artist",
            "supervisor_approved",
            "client_approved",
            "pipeline",
        )
        read_only_fields = ("id", "uuid")
        extra_kwargs = {"project": {"required": False}}
        validators = [
            LenientUniqueTogetherValidator(
                queryset=Shot.objects.all(),
                fields=["project", "code"],
            )
        ]
