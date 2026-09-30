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
            try:
                episode_number = int(data.get("episode_number"))
            except (TypeError, ValueError):
                episode_number = None
            if episode_number is not None:
                season_raw = data.get("season_number")
                season_missing = season_raw is None or (
                    isinstance(season_raw, str) and not season_raw.strip()
                )
                try:
                    season_number = int(season_raw or 1)
                except (TypeError, ValueError):
                    season_number = 1
                data["code"] = f"EP{season_number}{episode_number:02d}"
                # Keep the stored season consistent with the derived code.
                if season_missing:
                    data["season_number"] = season_number
        else:
            data["code"] = code.strip()
        # Keep the key present so ``validate`` owns the 400 instead of an
        # IntegrityError on the (project, code) unique constraint.
        data.setdefault("code", "")
        return super().to_internal_value(data)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        code = attrs.get("code")
        if isinstance(code, str):
            code = code.strip().upper()
            attrs["code"] = code
        if not code:
            raise serializers.ValidationError(
                {"code": ["Episode code is required when season/episode numbers cannot derive one."]}
            )
        return attrs
