from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Version
class VersionUpdateSerializer(BaseWriteSerializer):
    class Meta:
        model = Version
        fields = ("code","version_number","entity_type","entity_id","entity_code","entity_name","department","status","is_published","is_hero","is_archived","thumbnail_url","video_url","notes","tags","publishing_info")
