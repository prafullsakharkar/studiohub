from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import (
    FrameRangeMixin,
    LockedFieldsMixin,
    NormalizedCodeMixin,
    ProjectReferenceMixin,
    ScopedReferenceField,
)
from apps.production.models import Asset, Shot, Task, Version


class VersionCreateSerializer(
    NormalizedCodeMixin,
    FrameRangeMixin,
    LockedFieldsMixin,
    ProjectReferenceMixin,
    BaseWriteSerializer[Any],
):
    frame_range_fields = ("start_frame", "end_frame")
    locked_fields = {
        "is_published": "Use the publish action.",
        "is_hero": "Use the promote action.",
        "is_archived": "Use the archive and restore actions.",
    }

    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)
    is_archived = serializers.BooleanField(source="is_deleted", read_only=True)
    # Limited to the caller's projects; the viewset checks they belong to the
    # version's own project.
    shot = ScopedReferenceField(queryset=Shot.objects.all(), required=False, allow_null=True)
    asset = ScopedReferenceField(queryset=Asset.objects.all(), required=False, allow_null=True)
    task = ScopedReferenceField(queryset=Task.objects.all(), required=False, allow_null=True)

    class Meta:
        model = Version
        fields = (
            "id",
            "uuid",
            "code",
            "version_number",
            "project",
            "project_id",
            "project_code",
            "entity_type",
            "entity_id",
            "entity_code",
            "entity_name",
            "shot",
            "asset",
            "task",
            "department",
            "artist",
            "status",
            "is_published",
            "is_hero",
            "is_archived",
            "thumbnail_url",
            "video_url",
            "source_file_url",
            "frame_range",
            "start_frame",
            "end_frame",
            "resolution",
            "fps",
            "file_size_mb",
            "color_space",
            "file_path",
            "notes",
            "changelog",
            "tags",
            "publishing_info",
        )
        read_only_fields = ("id", "uuid", "version_number", "is_published", "is_hero")
        extra_kwargs = {"project": {"required": False}, "code": {"required": False}}
        # No unique-together validator: it would make ``code`` required. A code that is sent is checked by the
        # viewset (``_enforce_natural_key_uniqueness``); one that is not is derived, and unique, in the service.
        validators = []
