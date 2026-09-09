from typing import Any

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Media


class MediaUpdateSerializer(BaseWriteSerializer[Any]):
    class Meta:
        model = Media
        fields = ("entity_type","entity_id","media_type","category","file_format","storage_tier","source_url","preview_url","thumbnail_url","file_size_mb","resolution")
