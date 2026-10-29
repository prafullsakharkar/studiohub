from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import (
    FrameRangeMixin,
    LockedFieldsMixin,
    NormalizedCodeMixin,
)
from apps.production.api.serializers.shot.current_version import ShotCurrentVersionMixin
from apps.production.models import Shot


class ShotUpdateSerializer(  # pyright: ignore[reportUnsafeMultipleInheritance]
    ShotCurrentVersionMixin,
    NormalizedCodeMixin,
    FrameRangeMixin,
    LockedFieldsMixin,
    BaseWriteSerializer[Any],
):
    code_frozen_by = "shot"
    locked_fields = {
        "supervisor_approved": "Use the approve action.",
        "sequence_code": "Use sequence_id.",
        "current_version": "Derived from the shot's versions.",
    }

    #: read from the shot's sequence (D-32); sending a different value is a 400
    sequence_code = serializers.CharField(read_only=True)

    # Same reference aliases as create; the viewset resolves + validates the
    # episodic chain against the shot's (unchangeable) project before saving.
    episode_id = serializers.CharField(
        source="episode", write_only=True, required=False, allow_blank=True
    )
    sequence_id = serializers.CharField(
        source="sequence_ref", write_only=True, required=False, allow_blank=True
    )

    # Files the record under a show (TPN review TM-002). The viewset resolves it inside the project.
    show_id = serializers.UUIDField(
        source="show", write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = Shot
        fields = (
            "show_id",
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
        read_only_fields = ("supervisor_approved", "sequence_code")
