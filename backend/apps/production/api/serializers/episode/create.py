from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import (
    LenientUniqueTogetherValidator,
    ProjectReferenceMixin,
)
from apps.production.models import Episode


class EpisodeCreateSerializer(ProjectReferenceMixin, BaseWriteSerializer[Any]):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)
    code = serializers.CharField(max_length=50, required=False, allow_blank=True)

    class Meta:
        model = Episode
        fields = (
            "id",
            "uuid",
            "project",
            "project_id",
            "project_code",
            "code",
            "name",
            "season_number",
            "episode_number",
            "status",
            "description",
            "frame_in",
            "frame_out",
            "duration_frames",
            "air_date",
            "delivery_date",
            "metadata",
        )
        read_only_fields = ("id", "uuid")
        extra_kwargs = {"project": {"required": False}}
        validators = [
            LenientUniqueTogetherValidator(
                queryset=Episode.objects.all(),
                fields=["project", "code"],
            )
        ]

    def to_internal_value(self, data):
        # Frontend contract: ``code`` may be omitted; derive a stable
        # EP<season><episode:02d> natural key from the given numbers before
        # unique-together validation runs.
        if hasattr(data, "copy"):
            data = data.copy()
        code = data.get("code")
        if not (isinstance(code, str) and code.strip()):
            episode_number = data.get("episode_number")
            try:
                episode_number = int(episode_number)
            except (TypeError, ValueError):
                episode_number = None
            if episode_number is not None:
                try:
                    season_number = int(data.get("season_number") or 1)
                except (TypeError, ValueError):
                    season_number = 1
                data["code"] = f"EP{season_number}{episode_number:02d}"
        return super().to_internal_value(data)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if isinstance(attrs.get("code"), str):
            attrs["code"] = attrs["code"].strip().upper()
        return attrs
