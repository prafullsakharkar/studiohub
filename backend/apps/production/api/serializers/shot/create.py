from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import (
    FrameRangeMixin,
    LenientUniqueTogetherValidator,
    LockedFieldsMixin,
    NormalizedCodeMixin,
    ProjectReferenceMixin,
)
from apps.production.api.serializers.shot.current_version import ShotCurrentVersionMixin
from apps.production.models import Shot


class ShotCreateSerializer(  # pyright: ignore[reportUnsafeMultipleInheritance]
    ShotCurrentVersionMixin,
    NormalizedCodeMixin,
    FrameRangeMixin,
    LockedFieldsMixin,
    ProjectReferenceMixin,
    BaseWriteSerializer[Any],
):
    locked_fields = {
        "supervisor_approved": "Use the approve action.",
        "sequence_code": "Use sequence_id.",
        "current_version": "Derived from the shot's versions.",
    }

    #: read from the shot's sequence (D-32); sending a different value is a 400
    sequence_code = serializers.CharField(read_only=True)

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
            "current_version_id",
            "assigned_artist",
            "supervisor_approved",
            "client_approved",
            "pipeline",
        )
        read_only_fields = ("id", "uuid", "supervisor_approved", "sequence_code")
        extra_kwargs = {"project": {"required": False}}
        validators = [
            LenientUniqueTogetherValidator(
                queryset=Shot.objects.all(),
                fields=["project", "code"],
            )
        ]
