from typing import Any

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import LockedFieldsMixin, NormalizedCodeMixin
from apps.production.models import Version


class VersionUpdateSerializer(NormalizedCodeMixin, LockedFieldsMixin, BaseWriteSerializer[Any]):
    locked_fields = {
        "is_published": "Use the publish and unpublish actions.",
        "is_hero": "Use the promote action.",
    }

    class Meta:
        model = Version
        fields = ("code","version_number","entity_type","entity_id","entity_code","entity_name","department","status","is_published","is_hero","is_archived","thumbnail_url","video_url","notes","tags","publishing_info")
        read_only_fields = ("is_published","is_hero")
