from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import (
    LenientUniqueTogetherValidator,
    LockedFieldsMixin,
    ProjectReferenceMixin,
    ScopedReferenceField,
)
from apps.production.models import Asset, Shot, Task, Version


class VersionCreateSerializer(LockedFieldsMixin, ProjectReferenceMixin, BaseWriteSerializer[Any]):
    locked_fields = {
        "is_published": "Use the publish action.",
        "is_hero": "Use the promote action.",
    }

    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)
    # Limited to the caller's projects; the viewset checks they belong to the
    # version's own project.
    shot = ScopedReferenceField(queryset=Shot.objects.all(), required=False, allow_null=True)
    asset = ScopedReferenceField(queryset=Asset.objects.all(), required=False, allow_null=True)
    task = ScopedReferenceField(queryset=Task.objects.all(), required=False, allow_null=True)

    class Meta:
        model = Version
        fields = ("id","uuid","code","version_number","project","project_id","project_code","entity_type","entity_id","entity_code","entity_name","shot","asset","task","department","artist","status","is_published","is_hero","is_archived","thumbnail_url","video_url","source_file_url","frame_range","start_frame","end_frame","resolution","fps","file_size_mb","color_space","file_path","notes","changelog","tags","publishing_info")
        read_only_fields = ("id","uuid","is_published","is_hero")
        extra_kwargs = {"project": {"required": False}}
        validators = [
            LenientUniqueTogetherValidator(
                queryset=Version.objects.all(),
                fields=["project", "code"],
            )
        ]
