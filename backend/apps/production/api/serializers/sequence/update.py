from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import FrameRangeMixin, NormalizedCodeMixin
from apps.production.models import Sequence


class SequenceUpdateSerializer(NormalizedCodeMixin, FrameRangeMixin, BaseWriteSerializer[Any]):
    # An id or code of an episode of the sequence's project; the viewset resolves it
    # and applies the project's episode rule (D-12).
    episode_id = serializers.CharField(
        source="episode", write_only=True, required=False, allow_blank=True
    )

    # Files the record under a show (TPN review TM-002). The viewset resolves it inside the project.
    show_id = serializers.UUIDField(
        source="show", write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = Sequence
        fields = (
            "show_id",
            "episode_id",
            "name",
            "code",
            "status",
            "description",
            "frame_in",
            "frame_out",
            "department",
            "tags",
            "metadata",
        )
