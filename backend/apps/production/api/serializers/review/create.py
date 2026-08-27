from rest_framework import serializers
from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Review
class ReviewCreateSerializer(BaseWriteSerializer):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)
    class Meta:
        model = Review
        fields = ("id","uuid","title","code","description","project","entity_type","entity_id","entity_code","status","thumbnail_url","video_url")
        read_only_fields = ("id","uuid")
