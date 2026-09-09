from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Media


class MediaCreateSerializer(BaseWriteSerializer[Any]):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)
    class Meta:
        model = Media
        fields = ("id","uuid","project","entity_type","entity_id","media_type","category","file_format","storage_tier","source_url","preview_url","thumbnail_url","file_size_mb","resolution")
        read_only_fields = ("id","uuid")
