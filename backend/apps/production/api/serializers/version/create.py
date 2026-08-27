from rest_framework import serializers
from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Version
class VersionCreateSerializer(BaseWriteSerializer):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)
    class Meta:
        model = Version
        fields = ("id","uuid","code","version_number","project","entity_type","entity_id","entity_code","entity_name","shot","asset","task","department","artist","status","is_published","is_hero","is_archived","thumbnail_url","video_url","source_file_url","frame_range","start_frame","end_frame","resolution","fps","file_size_mb","color_space","file_path","notes","changelog","tags","publishing_info")
        read_only_fields = ("id","uuid")
