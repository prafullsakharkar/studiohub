from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.models import Media


class MediaSerializer(BaseReadSerializer[Any]):
    project_id = serializers.UUIDField(read_only=True, allow_null=True)
    class Meta:
        model = Media
        fields = ("id","uuid","project_id","entity_type","entity_id","code","name","title","file_name","media_type","category","file_format","storage_tier","source_url","preview_url","thumbnail_url","file_size_mb","resolution","created_at","updated_at")
        read_only_fields = ("id","uuid","created_at","updated_at")
